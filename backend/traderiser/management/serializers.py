# management/serializers.py
from rest_framework import serializers
from .models import ManagementRequest


class ManagementRequestSerializer(serializers.ModelSerializer):
    user = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ManagementRequest
        fields = [
            'id', 'management_id', 'user', 'stake', 'target_profit', 'payment_amount',
            'status', 'current_pnl', 'days', 'daily_target_profit'
        ]
        read_only_fields = ['management_id', 'payment_amount', 'status', 'current_pnl']


class InitiateManagementSerializer(serializers.Serializer):
    stake = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=50)
    target_profit = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=10)
    mpesa_phone = serializers.CharField(max_length=15)