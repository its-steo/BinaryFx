# agents/models.py
import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.validators import MinValueValidator, EmailValidator
from accounts.models import Account
import logging
from storages.backends.s3boto3 import S3Boto3Storage  # NEW: Import

logger = logging.getLogger(__name__)

User = get_user_model()

def agent_profile_upload_to(instance, filename):
    return f"agents/profiles/{instance.id}/{filename}"

def payment_screenshot_upload_to(instance, filename):
    return f"agents/screenshots/{instance.id}/{filename}"

class Agent(models.Model):
    METHOD_CHOICES = [
        ('mpesa', 'M-Pesa'),
        ('paypal', 'PayPal'),
        ('bank_transfer', 'Bank Transfer'),
    ]

    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    profile_picture = models.ImageField(
        upload_to=agent_profile_upload_to,
        storage=S3Boto3Storage(),  # NEW: Direct S3 upload
        null=True,
        blank=True
    )
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, db_index=True)
    is_active = models.BooleanField(default=True)
    location = models.CharField(max_length=100, blank=True, default="Kenya")
    rating = models.FloatField(default=0.0)
    reviews = models.IntegerField(default=0)
    min_amount = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text="Minimum deposit in KES"
    )
    max_amount = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True,
        help_text="Maximum deposit in KES"
    )
    response_time = models.CharField(max_length=50, blank=True, default="Within 5 minutes")
    verified = models.BooleanField(default=False)

    # Method-specific
    mpesa_phone = models.CharField(max_length=30, blank=True, null=True)
    paypal_email = models.EmailField(blank=True, null=True)
    paypal_link = models.URLField(blank=True, null=True)
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    bank_account_name = models.CharField(max_length=100, blank=True, null=True)
    bank_account_number = models.CharField(max_length=50, blank=True, null=True)
    bank_swift = models.CharField(max_length=11, blank=True, null=True)

    deposit_rate_kes_to_usd = models.DecimalField(
        max_digits=10, decimal_places=2, default=130.00,
        validators=[MinValueValidator(Decimal('1.00'))]
    )
    withdrawal_rate_usd_to_kes = models.DecimalField(
        max_digits=10, decimal_places=2, default=129.50,
        validators=[MinValueValidator(Decimal('1.00'))]
    )
    instructions = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class AgentDeposit(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='agent_deposits')
    agent = models.ForeignKey(Agent, on_delete=models.PROTECT)
    account = models.ForeignKey(Account, on_delete=models.PROTECT,
                                limit_choices_to={'account_type__in': ['standard', 'pro-fx']})
    amount_kes = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal('100'))])
    amount_usd = models.DecimalField(max_digits=14, decimal_places=2, editable=False)

    # AUTO-FILLED
    payment_method = models.CharField(max_length=30, choices=Agent.METHOD_CHOICES, editable=False, db_index=True)

    # Method-specific
    transaction_code = models.CharField(max_length=50, blank=True, null=True)  # M-Pesa
    paypal_transaction_id = models.CharField(max_length=50, blank=True, null=True)  # PayPal
    bank_reference = models.CharField(max_length=100, blank=True, null=True)  # Bank
    screenshot = models.ImageField(
        upload_to=payment_screenshot_upload_to,
        storage=S3Boto3Storage(),  # NEW: Direct S3 upload for screenshots
        null=True,
        blank=True
    )

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending')
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['payment_method']), models.Index(fields=['status'])]

    def save(self, *args, **kwargs):
        if not self.pk:
            self.payment_method = self.agent.method
        if not self.amount_usd:
            self.amount_usd = self.amount_kes / self.agent.deposit_rate_kes_to_usd
        super().save(*args, **kwargs)
        logger.info(f"Deposit {self.id} saved for user {self.user.username}")

    def __str__(self):
        return f"{self.user} → {self.agent} ({self.amount_kes} KES)"

class AgentWithdrawal(models.Model):
    STATUS_CHOICES = [
        ('pending_otp', 'Pending OTP'),
        ('otp_verified', 'OTP Verified'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='agent_withdrawals')
    agent = models.ForeignKey(Agent, on_delete=models.PROTECT)
    account = models.ForeignKey(Account, on_delete=models.PROTECT,
                                limit_choices_to={'account_type__in': ['standard', 'pro-fx']})

    amount_usd = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(10)])
    amount_kes = models.DecimalField(max_digits=14, decimal_places=2, editable=False)

    # AUTO-FILLED
    payment_method = models.CharField(max_length=30, choices=Agent.METHOD_CHOICES, editable=False, db_index=True)

    # NEW: User-specific withdrawal details
    user_paypal_email = models.EmailField(blank=True, null=True, validators=[EmailValidator()])
    user_bank_name = models.CharField(max_length=100, blank=True, null=True)
    user_bank_account_name = models.CharField(max_length=100, blank=True, null=True)
    user_bank_account_number = models.CharField(max_length=50, blank=True, null=True)
    user_bank_swift = models.CharField(max_length=11, blank=True, null=True)

    otp_code = models.CharField(max_length=6, blank=True)
    otp_sent_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='pending_otp')
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['payment_method']), models.Index(fields=['status'])]

    def save(self, *args, **kwargs):
        if not self.pk:
            self.payment_method = self.agent.method
        if not self.amount_kes:
            self.amount_kes = self.amount_usd * self.agent.withdrawal_rate_usd_to_kes
        super().save(*args, **kwargs)
        logger.info(f"Withdrawal {self.id} saved for user {self.user.username}")

    def is_otp_expired(self):
        if not self.otp_sent_at:
            return True
        return timezone.now() > self.otp_sent_at + timezone.timedelta(minutes=10)

    def __str__(self):
        return f"{self.user} ← {self.agent} ({self.amount_usd} USD)"