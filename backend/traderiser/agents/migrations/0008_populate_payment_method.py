from django.db import migrations

def populate_payment_method(apps, schema_editor):
    AgentDeposit = apps.get_model('agents', 'AgentDeposit')
    AgentWithdrawal = apps.get_model('agents', 'AgentWithdrawal')
    for deposit in AgentDeposit.objects.filter(payment_method=''):
        deposit.payment_method = deposit.agent.method
        deposit.save(update_fields=['payment_method'])
    for withdrawal in AgentWithdrawal.objects.filter(payment_method=''):
        withdrawal.payment_method = withdrawal.agent.method
        withdrawal.save(update_fields=['payment_method'])

def reverse_populate(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('agents', '0007_fix_long_phones'),
    ]

    operations = [
        migrations.RunPython(populate_payment_method, reverse_populate),
    ]