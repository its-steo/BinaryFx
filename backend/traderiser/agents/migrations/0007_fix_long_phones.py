from django.db import migrations, models

def truncate_phones(apps, schema_editor):
    Agent = apps.get_model('agents', 'Agent')
    for a in Agent.objects.all():
        changed = False
        if a.phone and len(a.phone) > 30:
            a.phone = a.phone[:30]
            changed = True
        if a.mpesa_phone and len(a.mpesa_phone) > 30:
            a.mpesa_phone = a.mpesa_phone[:30]
            changed = True
        if changed:
            a.save(update_fields=['phone', 'mpesa_phone'])

class Migration(migrations.Migration):
    dependencies = [
        ('agents', '0006_alter_agentdeposit_unique_together_and_more'),
    ]

    operations = [
        migrations.RunPython(truncate_phones, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name='agent',
            name='phone',
            field=models.CharField(max_length=30, blank=True, help_text='Agent contact phone (international format)'),
        ),
        migrations.AlterField(
            model_name='agent',
            name='mpesa_phone',
            field=models.CharField(max_length=30, blank=True, null=True, help_text='M-Pesa registered phone number'),
        ),
    ]