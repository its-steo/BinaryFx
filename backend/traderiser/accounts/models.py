# accounts/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.contrib.auth.validators import UnicodeUsernameValidator
from decimal import Decimal
from django.apps import apps

class User(AbstractUser):
    username_validator = UnicodeUsernameValidator()

    username = models.CharField(
        max_length=150,
        unique=True,
        help_text='Required. 150 characters or fewer. Letters, digits and @/./+/-/_ only.',
        validators=[username_validator],
    )
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    is_sashi = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.username

    def can_create_account(self, account_type):
        existing_accounts = self.accounts.all()
        existing_types = {acc.account_type for acc in existing_accounts}
        if len(existing_accounts) >= 3:
            return False
        if account_type == 'demo' and 'demo' in existing_types:
            return False
        if account_type == 'pro-fx':
            # Pro-FX only if standard (real) exists, and not already created
            has_standard = 'standard' in existing_types
            return has_standard and 'pro-fx' not in existing_types
        if account_type == 'standard' and 'standard' in existing_types:
            return False
        # No other real types allowed (e.g., no pro, islamic – assuming focus on standard/pro-fx)
        if account_type != 'standard' and account_type != 'demo' and account_type != 'pro-fx':
            return False
        return True

class Account(models.Model):
    ACCOUNT_TYPES = [
        ('standard', 'TradeRiser Standard'),
        ('pro', 'TradeRiser Pro'),
        ('islamic', 'TradeRiser Islamic'),
        ('options', 'TradeRiser Options'),
        ('crypto', 'TradeRiser Crypto'),
        ('demo', 'TradeRiser Demo'),
        ('pro-fx', 'TradeRiser Pro-FX'),  # New account type
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='accounts')
    account_type = models.CharField(max_length=50, choices=ACCOUNT_TYPES)

    class Meta:
        unique_together = ('user', 'account_type')

    @property
    def balance(self):
        """Property to fetch balance from the main USD wallet."""
        try:
            Wallet = apps.get_model('wallet', 'Wallet')
            Currency = apps.get_model('wallet', 'Currency')
            usd = Currency.objects.get(code='USD')
            wallet = Wallet.objects.get(account=self, wallet_type='main', currency=usd)
            return wallet.balance
        except (Currency.DoesNotExist, Wallet.DoesNotExist):
            # Fallback for initial creation
            return Decimal('10000.00') if self.account_type == 'demo' else Decimal('0.00')

    @balance.setter
    def balance(self, value):
        """Setter to update the main USD wallet balance."""
        Wallet = apps.get_model('wallet', 'Wallet')
        Currency = apps.get_model('wallet', 'Currency')
        usd = Currency.objects.get_or_create(code='USD', defaults={'name': 'US Dollar', 'symbol': '$'})[0]
        wallet, created = Wallet.objects.get_or_create(
            account=self, wallet_type='main', currency=usd,
            defaults={'balance': value}
        )
        if not created:
            wallet.balance = value
            wallet.save()

    def save(self, *args, **kwargs):
        is_new = not self.pk
        super().save(*args, **kwargs)
        if is_new:
            # Set initial balance via setter
            initial_balance = Decimal('10000.00') if self.account_type == 'demo' else Decimal('0.00')
            self.balance = initial_balance

    def reset_demo_balance(self):
        if self.account_type == 'demo':
            self.balance = Decimal('10000.00')

    def __str__(self):
        return f"{self.user.username} - {self.account_type}"