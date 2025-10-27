# forex/tasks.py
from celery import shared_task
from .models import Position, Wallet, Currency

@shared_task
def update_all_positions():
    positions = Position.objects.filter(status='open')
    usd = Currency.objects.get(code='USD')
    
    for position in positions:
        wallet = Wallet.objects.get(account=position.account, wallet_type='main', currency=usd)
        current_price = position.pair.get_current_price(
            position.entry_time,
            is_sashi=position.user.is_sashi,
            direction=position.direction
        )
        position.update_floating_p_l(current_price)