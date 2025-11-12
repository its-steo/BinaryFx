# management/management/commands/run_daily_trades.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from management.models import ManagementRequest
from dashboard.models import Transaction
from decimal import Decimal
import random

class Command(BaseCommand):
    help = 'Run daily auto-trades'

    def handle(self, *args, **options):
        today = timezone.now().date()
        active = ManagementRequest.objects.filter(
            status='active',
            start_date__lte=today,
            end_date__gte=today
        )

        for req in active:
            is_sashi = req.user.is_sashi
            win_rate = 0.80 if is_sashi else 0.30
            is_win = random.random() < win_rate
            multiplier = random.uniform(0.8, 1.5) if is_win else random.uniform(0.5, 1.2)
            pnl = Decimal(round(req.daily_stake * multiplier if is_win else -req.daily_stake * multiplier, 2))

            req.current_pnl += pnl
            if req.current_pnl >= req.target_profit:
                req.status = 'completed'
            req.save()

            Transaction.objects.create(
                account=req.user.accounts.first(),
                amount=pnl,
                transaction_type='profit' if is_win else 'loss',
                description=f"Day {req.days - (req.end_date - today).days}"
            )

        self.stdout.write(self.style.SUCCESS("Daily trades processed"))