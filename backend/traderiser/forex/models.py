# forex/models.py
import random
from decimal import Decimal
from django.db import models
from django.utils import timezone
from accounts.models import Account, User
from wallet.models import Wallet, Currency
from dashboard.models import Transaction
import logging

logger = logging.getLogger(__name__)

class ForexPair(models.Model):
    name = models.CharField(max_length=10, unique=True)
    base_currency = models.CharField(max_length=3)
    quote_currency = models.CharField(max_length=3)
    pip_value = models.DecimalField(max_digits=10, decimal_places=5, default=Decimal('0.0001'))
    contract_size = models.IntegerField(default=100000)
    spread = models.DecimalField(max_digits=10, decimal_places=5, default=Decimal('0.0001'))
    base_simulation_price = models.DecimalField(max_digits=10, decimal_places=5, default=Decimal('1.1000'))

    def __str__(self):
        return self.name

    def get_current_price(self, entry_time=None, is_sashi=False, direction='buy'):
        """Simulate price with Sashi/non-Sashi behavior."""
        if entry_time:
            minutes_passed = (timezone.now() - entry_time).total_seconds() / 60
            if is_sashi:
                if minutes_passed >= 30:
                    # Ensure profit: higher for buy, lower for sell
                    return self.base_simulation_price + Decimal('0.0020') if direction == 'buy' else self.base_simulation_price - Decimal('0.0020')
                # 10% chance of small loss for realism
                if random.random() < 0.1:
                    return max(self.base_simulation_price - Decimal('0.0005'), Decimal('0.0001'))
            else:
                # Non-Sashi: Force loss after 10–20 minutes
                if minutes_passed >= random.uniform(10, 20):
                    # Lower for buy, higher for sell to cause loss
                    return self.base_simulation_price - Decimal('0.0020') if direction == 'buy' else self.base_simulation_price + Decimal('0.0020')

        # Default random walk
        volatility = Decimal(str(random.uniform(-0.0005, 0.0005)))
        return max(self.base_simulation_price + volatility, Decimal('0.0001'))

class Position(models.Model):
    DIRECTIONS = [('buy', 'Buy'), ('sell', 'Sell')]
    STATUSES = [('open', 'Open'), ('closed', 'Closed')]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forex_positions')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='forex_positions')
    pair = models.ForeignKey(ForexPair, on_delete=models.PROTECT)
    direction = models.CharField(max_length=4, choices=DIRECTIONS)
    volume_lots = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.01'))
    entry_price = models.DecimalField(max_digits=10, decimal_places=5)
    entry_time = models.DateTimeField(default=timezone.now)
    sl = models.DecimalField(max_digits=10, decimal_places=5, null=True, blank=True)
    tp = models.DecimalField(max_digits=10, decimal_places=5, null=True, blank=True)
    floating_p_l = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=6, choices=STATUSES, default='open')
    leverage = models.IntegerField(default=500)

    class Meta:
        ordering = ['-entry_time']

    def __str__(self):
        return f"{self.user.username} - {self.pair.name} {self.direction} ({self.status})"

    def calculate_margin(self):
        return (self.volume_lots * self.pair.contract_size * self.entry_price) / self.leverage

    def update_floating_p_l(self, current_price=None):
        """Update P&L and check SL/TP or margin call."""
        if self.status == 'closed':
            return
        if not current_price:
            current_price = self.pair.get_current_price(self.entry_time, is_sashi=self.user.is_sashi, direction=self.direction)
        pip_delta = (Decimal(current_price) - self.entry_price) / self.pair.pip_value if self.direction == 'buy' else (self.entry_price - Decimal(current_price)) / self.pair.pip_value
        self.floating_p_l = pip_delta * self.volume_lots * Decimal('10')
        logger.info(f"Updated floating_p_l for position {self.id}: {self.floating_p_l} (pip_delta={pip_delta}, current_price={current_price})")
        self.save()

        # Check SL/TP
        if self.sl and ((current_price <= self.sl and self.direction == 'buy') or (current_price >= self.sl and self.direction == 'sell')):
            self.close_position(current_price, is_auto=True, close_reason='sl')
        elif self.tp and ((current_price >= self.tp and self.direction == 'buy') or (current_price <= self.tp and self.direction == 'sell')):
            self.close_position(current_price, is_auto=True, close_reason='tp')

        # Check margin call for non-Sashi users
        if not self.user.is_sashi:
            usd = Currency.objects.get(code='USD')
            wallet = Wallet.objects.get(account=self.account, wallet_type='main', currency=usd)
            if self.check_margin_call(wallet.balance):
                self.close_position(current_price, is_auto=True, close_reason='margin')

    def close_position(self, current_price, is_auto=False, close_reason='manual'):
        if self.status == 'closed':
            return
        p_l = self.floating_p_l - (self.pair.spread * self.volume_lots * Decimal('10'))
        logger.info(f"Closing position {self.id}: initial p_l={p_l}, user.is_sashi={self.user.is_sashi}")

        if self.user.is_sashi and p_l < 0:
            p_l = abs(p_l) * Decimal('0.9')
            logger.info(f"Sashi adjustment: p_l adjusted to {p_l}")
            Transaction.objects.create(account=self.account, amount=p_l, transaction_type='trade', description='Sashi adjust win')

        usd = Currency.objects.get(code='USD')
        wallet = Wallet.objects.get(account=self.account, wallet_type='main', currency=usd)
        logger.info(f"Wallet balance before close: {wallet.balance}")

        # Cap loss to prevent negative balance
        if p_l < 0 and -p_l > wallet.balance:
            p_l = -wallet.balance
            logger.info(f"Loss capped to balance: p_l set to {p_l}")

        wallet.balance += p_l
        wallet.save()
        logger.info(f"Wallet balance after close: {wallet.balance}")

        trans_type = 'profit' if p_l > 0 else 'loss'
        Transaction.objects.create(account=self.account, amount=p_l, transaction_type=trans_type, description=f'Forex close: {self.pair.name}')
        self.status = 'closed'
        self.save()
        ForexTrade.objects.create(
            position=self,
            close_price=current_price,
            realized_p_l=p_l,
            close_time=timezone.now(),
            close_reason=close_reason
        )

    def check_margin_call(self, wallet_balance):
        """Close position if loss equals or exceeds wallet balance for non-Sashi users."""
        if self.user.is_sashi or self.status == 'closed':
            return False
        return self.floating_p_l <= 0 and abs(self.floating_p_l) >= wallet_balance

class ForexTrade(models.Model):
    position = models.OneToOneField(Position, on_delete=models.CASCADE)
    close_price = models.DecimalField(max_digits=10, decimal_places=5)
    realized_p_l = models.DecimalField(max_digits=12, decimal_places=2)
    close_time = models.DateTimeField(default=timezone.now)
    close_reason = models.CharField(max_length=10)

    def __str__(self):
        return f"Closed: {self.position}"