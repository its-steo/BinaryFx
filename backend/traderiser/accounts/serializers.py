from rest_framework import serializers
from .models import User, Account

class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Account
        fields = ['id', 'account_type', 'balance']
        read_only_fields = ['id', 'balance']

class UserSerializer(serializers.ModelSerializer):
    accounts = AccountSerializer(many=True, read_only=True)
    referral_link = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'phone',
            'is_sashi', 'is_email_verified', 'accounts', 'is_staff',
            'is_marketo', 'referral_link'
        ]
        read_only_fields = [
            'id', 'is_sashi', 'is_email_verified', 'is_staff',
            'is_marketo', 'referral_link'
        ]

    # ────────────────────────────────────────────────
    # This MUST be indented at the same level as Meta
    # ────────────────────────────────────────────────
    def get_referral_link(self, obj):
        if obj.is_marketo and obj.referral_code:
            # For local development:
            #return f"http://localhost:3000/signup/?ref={obj.referral_code}"
            # Later in production you should use:
             return f"https://traderiserpro.co.ke/signup/?ref={obj.referral_code}"
        return None