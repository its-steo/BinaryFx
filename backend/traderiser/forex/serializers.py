# forex/serializers.py
from rest_framework import serializers
from .models import ForexPair, Position, ForexTrade

class ForexPairSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForexPair
        fields = '__all__'

class PositionSerializer(serializers.ModelSerializer):
    pair = ForexPairSerializer(read_only=True)
    class Meta:
        model = Position
        fields = '__all__'
        read_only_fields = ('user', 'account', 'entry_price', 'entry_time', 'floating_p_l', 'status')

class ForexTradeSerializer(serializers.ModelSerializer):
    position = PositionSerializer(read_only=True)
    class Meta:
        model = ForexTrade
        fields = '__all__'