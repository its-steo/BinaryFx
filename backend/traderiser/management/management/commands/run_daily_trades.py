# management/management/commands/run_daily_trades.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.core.mail import send_mail
from django.conf import settings
from management.models import ManagementRequest
from wallet.models import Wallet, WalletTransaction, Currency
from decimal import Decimal
import random
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Simulate daily trading profit/loss for active management accounts'

    def handle(self, *args, **options):
        today = timezone.now().date()
        active_requests = ManagementRequest.objects.filter(
            status='active',
            start_date__lte=today,
            end_date__gte=today
        )

        if not active_requests.exists():
            self.stdout.write("No active management requests today.")
            return

        try:
            usd = Currency.objects.get(code='USD')
        except Currency.DoesNotExist:
            self.stdout.write(self.style.ERROR("USD currency not found!"))
            return

        processed = 0
        completed_today = []

        for req in active_requests:
            try:
                account = req.user.accounts.get(account_type=req.account_type)
                wallet = account.wallets.get(wallet_type='main', currency=usd)

                is_sashi = getattr(req.user, 'is_sashi', False)
                win_rate = 0.80 if is_sashi else 0.70
                is_win = random.random() < win_rate

                multiplier = random.uniform(1.0, 1.8) if is_win else random.uniform(0.5, 0.9)
                daily_pnl = req.daily_stake * Decimal(str(multiplier))
                if not is_win:
                    daily_pnl = -daily_pnl
                daily_pnl = daily_pnl.quantize(Decimal('0.01'))

                with transaction.atomic():
                    wallet.balance += daily_pnl
                    wallet.save()

                    WalletTransaction.objects.create(
                        wallet=wallet,
                        transaction_type='deposit' if is_win else 'withdrawal',
                        amount=abs(daily_pnl),
                        currency=usd,
                        status='completed',
                        description=f"Daily management {'profit' if is_win else 'loss'} - {req.management_id}"
                    )

                    req.current_pnl += daily_pnl
                    req.save()

                    # Check if target reached
                    if req.current_pnl >= req.target_profit:
                        req.status = 'completed'
                        req.save()
                        completed_today.append(req)
                        self.stdout.write(
                            self.style.SUCCESS(f"🎯 TARGET REACHED & COMPLETED: {req.management_id}")
                        )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"Processed {req.management_id}: {'+' if daily_pnl > 0 else ''}{daily_pnl} USD | Total PnL: ${req.current_pnl}"
                    )
                )
                processed += 1

            except Exception as e:
                logger.error(f"Error processing {req.management_id}: {e}")
                self.stdout.write(self.style.ERROR(f"Failed {req.management_id}: {e}"))

        # Send completion emails
        for req in completed_today:
            try:
                send_mail(
                    "🎉 Account Management Target Achieved!",
                    f"Hi {req.user.username},\n\n"
                    f"Congratulations! Your account management has successfully reached the target profit.\n\n"
                    f"Management ID: {req.management_id}\n"
                    f"Account Type: {req.get_account_type_display()}\n"
                    f"Target Profit: ${req.target_profit}\n"
                    f"Final PnL: ${req.current_pnl}\n"
                    f"Duration: {req.days} days\n"
                    f"Start Date: {req.start_date}\n"
                    f"End Date: {req.end_date}\n\n"
                    f"Your profits are now available in your wallet.\n"
                    f"Thank you for trusting us!\n\n"
                    f"Best regards,\nTradeRiser Team",
                    settings.DEFAULT_FROM_EMAIL,
                    [req.user.email],
                    fail_silently=False,
                )
                self.stdout.write(self.style.SUCCESS(f"Completion email sent to {req.user.email}"))
            except Exception as e:
                logger.error(f"Failed to send completion email for {req.management_id}: {e}")
                self.stdout.write(self.style.WARNING(f"Email failed for {req.management_id}"))

        self.stdout.write(
            self.style.SUCCESS(f"Daily trades completed: {processed} processed, {len(completed_today)} targets reached today.")
        )