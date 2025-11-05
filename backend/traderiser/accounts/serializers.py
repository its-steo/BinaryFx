from rest_framework import serializers
from .models import User, Account

class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)  # Now from property

    class Meta:
        model = Account
        fields = ['id', 'account_type', 'balance']
        read_only_fields = ['id', 'balance']

class UserSerializer(serializers.ModelSerializer):
    accounts = AccountSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone', 'is_sashi', 'is_email_verified', 'accounts', 'is_staff']
        read_only_fields = ['id', 'is_sashi', 'is_email_verified', 'is_staff']