import random
from decimal import Decimal
from django.db import models, transaction
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
    contract_size = models.IntegerField(default=100000)  # Standard contract size (e.g., 100,000 units)
    spread = models.DecimalField(max_digits=10, decimal_places=5, default=Decimal('0.0001'))  # Spread in pips
    base_simulation_price = models.DecimalField(max_digits=10, decimal_places=5, default=Decimal('1.1000'))
    TIME_FRAMES = [
        ('M1', '1 Minute'),
        ('M5', '5 Minutes'),
        ('M15', '15 Minutes'),
        ('H1', '1 Hour'),
        ('H4', '4 Hours'),
        ('D1', '24 Hours'),
    ]
    default_time_frame = models.CharField(max_length=3, choices=TIME_FRAMES, default='M1')

    def __str__(self):
        return self.name

    def get_current_price(self, entry_time=None, is_sashi=False, direction='buy', time_frame='M1'):
        """Simulate price with time frame consideration."""
        if not entry_time:
            entry_time = timezone.now()
        minutes_passed = (timezone.now() - entry_time).total_seconds() / 60

        # Adjust volatility based on time frame
        time_frame_multiplier = {
            'M1': 1,
            'M5': 5,
            'M15': 15,
            'H1': 60,
            'H4': 240,
            'D1': 1440,
        }
        volatility_scale = time_frame_multiplier[time_frame] / 60  # Normalize to minutes

        if is_sashi:
            if minutes_passed >= 30 * time_frame_multiplier[time_frame] / 60:
                return self.base_simulation_price + Decimal('0.0020') if direction == 'buy' else self.base_simulation_price - Decimal('0.0020')
            if random.random() < 0.1:
                return max(self.base_simulation_price - Decimal('0.0005') * volatility_scale, Decimal('0.0001'))
        else:
            if minutes_passed >= random.uniform(10, 20) * time_frame_multiplier[time_frame] / 60:
                return self.base_simulation_price - Decimal('0.0020') if direction == 'buy' else self.base_simulation_price + Decimal('0.0020')

        volatility = Decimal(str(random.uniform(-0.0005, 0.0005) * volatility_scale))
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
    time_frame = models.CharField(max_length=3, choices=ForexPair.TIME_FRAMES, default='M1')

    class Meta:
        ordering = ['-entry_time']

    def __str__(self):
        return f"{self.user.username} - {self.pair.name} {self.direction} ({self.status})"

    def calculate_margin(self):
        """Calculate the initial margin based on volume, entry price, and leverage."""
        return (self.volume_lots * self.pair.contract_size * self.entry_price) / self.leverage

    def update_floating_p_l(self, current_price=None, wallet_balance=None):
        """Update floating P&L based on current price and check conditions."""
        if self.status == 'closed':
            return
        if not current_price:
            current_price = self.pair.get_current_price(
                self.entry_time,
                is_sashi=self.user.is_sashi,
                direction=self.direction,
                time_frame=self.time_frame
            )
        pip_value = self.pair.pip_value
        pip_delta = (Decimal(current_price) - self.entry_price) / pip_value if self.direction == 'buy' else (self.entry_price - Decimal(current_price)) / pip_value
        # P&L = (pip_delta * volume_lots * contract_size * pip_value) - (spread cost)
        self.floating_p_l = (pip_delta * self.volume_lots * self.pair.contract_size * pip_value) - \
                           (self.pair.spread * self.volume_lots * self.pair.contract_size * pip_value)
        logger.info(f"Updated floating_p_l for position {self.id}: {self.floating_p_l} (pip_delta={pip_delta}, current_price={current_price})")
        self.save()

        # Check SL/TP
        if self.sl and ((current_price <= self.sl and self.direction == 'buy') or (current_price >= self.sl and self.direction == 'sell')):
            self.close_position(current_price, is_auto=True, close_reason='sl')
        elif self.tp and ((current_price >= self.tp and self.direction == 'buy') or (current_price <= self.tp and self.direction == 'sell')):
            self.close_position(current_price, is_auto=True, close_reason='tp')

        # Check margin call if wallet_balance is provided
        if wallet_balance is not None and not self.user.is_sashi:
            if self.check_margin_call(wallet_balance):
                self.close_position(current_price, is_auto=True, close_reason='margin')

    def close_position(self, current_price, is_auto=False, close_reason='manual'):
        """Close the position and update wallet balance with margin and realized P&L."""
        if self.status == 'closed':
            return

        # Update floating P&L with current price
        self.update_floating_p_l(current_price)
        realized_p_l = self.floating_p_l
        logger.info(f"Closing position {self.id}: Entry {self.entry_price}, Close {current_price}, Realized P&L {realized_p_l}")

        # Sashi adjustment for losses
        if self.user.is_sashi and realized_p_l < 0:
            adjusted_loss = abs(realized_p_l) * Decimal('0.9')
            realized_p_l = -adjusted_loss
            logger.info(f"Sashi adjustment: P&L adjusted to {realized_p_l}")
            Transaction.objects.create(
                account=self.account,
                amount=adjusted_loss,
                transaction_type='sashi_adjustment',
                description=f'Sashi win adjustment for {self.pair.name}'
            )

        # Get wallet and initial margin
        usd = Currency.objects.get(code='USD')
        wallet = Wallet.objects.get(account=self.account, wallet_type='main', currency=usd)
        initial_margin = self.calculate_margin()
        logger.info(f"Wallet balance before close: {wallet.balance}, Initial Margin: {initial_margin}")

        # Cap loss to available balance if necessary
        if realized_p_l < 0 and -realized_p_l > wallet.balance:
            realized_p_l = -wallet.balance
            logger.info(f"Loss capped to balance: P&L set to {realized_p_l}")

        # Update balance: Return initial margin + add realized P&L
        with transaction.atomic():
            wallet.balance += initial_margin + realized_p_l  # Return margin + profit/loss
            wallet.save()
            logger.info(f"Wallet balance after close: {wallet.balance}")

            trans_type = 'profit' if realized_p_l > 0 else 'loss'
            Transaction.objects.create(
                account=self.account,
                amount=realized_p_l,
                transaction_type=trans_type,
                description=f'Forex close: {self.pair.name}'
            )

        # Record trade
        trade = ForexTrade.objects.create(
            position=self,
            close_price=current_price,
            realized_p_l=realized_p_l,
            close_time=timezone.now(),
            close_reason=close_reason
        )

        self.status = 'closed'
        self.floating_p_l = Decimal('0.00')
        self.save()
        return trade

    def check_margin_call(self, wallet_balance):
        """Check if a margin call is triggered without recursive update."""
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