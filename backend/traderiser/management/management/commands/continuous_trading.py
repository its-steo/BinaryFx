# management/management/commands/continuous_trading.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction, close_old_connections
from django.core.mail import send_mail
from django.conf import settings
from management.models import ManagementRequest
from wallet.models import Wallet, Currency
from dashboard.models import Transaction  # Import dashboard Transaction
from decimal import Decimal
import random
import time
import logging
from datetime import date

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Continuously simulate trading every 2 minutes until targets are reached'

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=120,  # seconds
            help='Interval between trades in seconds (default: 120 = 2 minutes)',
        )

    def handle(self, *args, **options):
        interval = options['interval']
        self.stdout.write(self.style.SUCCESS(f"Starting continuous trading simulator (interval: {interval}s)"))
        self.stdout.write("Press Ctrl+C to stop")

        try:
            usd = Currency.objects.get(code='USD')
        except Currency.DoesNotExist:
            self.stdout.write(self.style.ERROR("USD currency not found!"))
            return

        # Track daily progress to know when daily target is reached
        last_daily_email_date = {}
        daily_pnl_today = {}

        while True:
            try:
                today = date.today()
                active_requests = ManagementRequest.objects.filter(status='active')

                if not active_requests.exists():
                    self.stdout.write("No active management requests. Sleeping...")
                    time.sleep(interval)
                    continue

                trades_this_cycle = 0

                for req in active_requests:
                    try:
                        close_old_connections()  # Prevent DB connection issues

                        account = req.user.accounts.get(account_type=req.account_type)
                        wallet = account.wallets.get(wallet_type='main', currency=usd)

                        # Small realistic trade (1/50th of daily target per run)
                        trade_amount = req.daily_target_profit / Decimal('50')  # ~50 runs per day
                        trade_amount = trade_amount.quantize(Decimal('0.01'))

                        is_sashi = getattr(req.user, 'is_sashi', False)
                        win_rate = 0.85 if is_sashi else 0.72
                        is_win = random.random() < win_rate

                        multiplier = random.uniform(0.8, 1.4) if is_win else random.uniform(0.6, 1.0)
                        pnl = trade_amount * Decimal(str(multiplier))
                        if not is_win:
                            pnl = -pnl
                        pnl = pnl.quantize(Decimal('0.01'))

                        with transaction.atomic():
                            wallet.balance += pnl
                            wallet.save()

                            # Create dashboard Transaction instead of WalletTransaction
                            Transaction.objects.create(
                                account=account,
                                amount=pnl if pnl > 0 else -abs(pnl),
                                transaction_type='credit' if pnl > 0 else 'debit',
                                description=f"Management trade {'profit' if pnl > 0 else 'loss'} - {req.management_id}"
                            )

                            req.current_pnl += pnl
                            req.save()

                            req_id = req.id
                            if req_id not in daily_pnl_today:
                                daily_pnl_today[req_id] = Decimal('0.00')
                            daily_pnl_today[req_id] += pnl

                            if req_id not in last_daily_email_date:
                                last_daily_email_date[req_id] = None

                            trades_this_cycle += 1

                        # Check if DAILY target reached
                        if daily_pnl_today[req_id] >= req.daily_target_profit and last_daily_email_date.get(req_id) != today:
                            send_mail(
                                "Daily Target Profit Reached! 📈",
                                f"Hi {req.user.username},\n\n"
                                f"Great news! Today's daily target of ${req.daily_target_profit} has been reached.\n\n"
                                f"Management ID: {req.management_id}\n"
                                f"Account Type: {req.get_account_type_display()}\n"
                                f"Today's Profit: ${daily_pnl_today[req_id]:.2f}\n"
                                f"Total PnL: ${req.current_pnl:.2f} / ${req.target_profit}\n\n"
                                f"Trading continues tomorrow!\n\n"
                                f"TradeRiser Team",
                                settings.DEFAULT_FROM_EMAIL,
                                [req.user.email],
                                fail_silently=False,
                            )
                            last_daily_email_date[req_id] = today
                            self.stdout.write(self.style.SUCCESS(f"DAILY TARGET REACHED email sent for {req.management_id}"))

                        # Check if OVERALL target reached
                        if req.current_pnl >= req.target_profit:
                            req.status = 'completed'
                            req.save()

                            send_mail(
                                "🎉 Management Target Fully Achieved!",
                                f"Hi {req.user.username},\n\n"
                                f"CONGRATULATIONS! Your account management is complete.\n\n"
                                f"Management ID: {req.management_id}\n"
                                f"Final Profit: ${req.current_pnl:.2f}\n"
                                f"Target: ${req.target_profit}\n"
                                f"Duration: {req.days} days\n\n"
                                f"Your profits are now fully available.\n"
                                f"Thank you for choosing TradeRiser!\n\n"
                                f"Best regards,\nTeam",
                                settings.DEFAULT_FROM_EMAIL,
                                [req.user.email],
                                fail_silently=False,
                            )
                            self.stdout.write(self.style.SUCCESS(f"OVERALL TARGET REACHED & COMPLETED: {req.management_id}"))

                    except Exception as e:
                        logger.error(f"Error in continuous trading for {req.management_id}: {e}")

                if trades_this_cycle > 0:
                    self.stdout.write(
                        self.style.SUCCESS(f"Cycle complete: {trades_this_cycle} trades simulated at {timezone.now().strftime('%H:%M:%S')}")
                    )
                else:
                    self.stdout.write("No trades this cycle")

                time.sleep(interval)

            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING("\nStopping continuous trading simulator..."))
                break
            except Exception as e:
                logger.error(f"Critical error in continuous loop: {e}")
                time.sleep(interval)  # Don't crash, just wait and retry