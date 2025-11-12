# management/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from decimal import Decimal
from wallet.models import WalletTransaction
import uuid

User = get_user_model()

def generate_management_id():
    return f"MGMT-{uuid.uuid4().hex[:8].upper()}"

class ManagementRequest(models.Model):
    STATUS_CHOICES = [
        ('pending_payment', 'Pending Payment'),
        ('payment_verified', 'Payment Verified'),
        ('credentials_pending', 'Awaiting Credentials'),
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='management_requests')
    management_id = models.CharField(max_length=20, unique=True, default=generate_management_id)

    stake = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(50)])
    target_profit = models.DecimalField(max_digits=12, decimal_places=2)
    payment_amount = models.DecimalField(max_digits=12, decimal_places=2)
    mpesa_phone = models.CharField(max_length=15)

    payment_transaction = models.OneToOneField(
        WalletTransaction, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='management_request'
    )

    account_email = models.EmailField(blank=True, null=True)
    account_password = models.CharField(max_length=255, blank=True, null=True)  # PLAIN TEXT

    days = models.PositiveIntegerField(null=True, blank=True)
    daily_stake = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    daily_target_profit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    current_pnl = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_payment')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.payment_amount:
            self.payment_amount = self.target_profit * Decimal('0.20')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} - ${self.target_profit} in {self.days} days"