# forex/serializers.py
from rest_framework import serializers
from .models import ForexPair, Position, ForexTrade, ForexRobot, UserRobot, BotLog, TIME_FRAMES  # ← Import TIME_FRAMES

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

class ForexRobotSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ForexRobot
        fields = '__all__'

    def get_image_url(self, obj):
        return obj.image_url

class UserRobotSerializer(serializers.ModelSerializer):
    robot = ForexRobotSerializer(read_only=True)
    stake_per_trade = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    selected_pair = ForexPairSerializer(read_only=True)
    selected_pair_id = serializers.PrimaryKeyRelatedField(
        queryset=ForexPair.objects.all(), source='selected_pair', write_only=True, required=False
    )
    timeframe = serializers.ChoiceField(choices=TIME_FRAMES, required=False)  # ← Fixed

    class Meta:
        model = UserRobot
        fields = '__all__'
        read_only_fields = ('user', 'purchased_at', 'is_running', 'last_trade_time')
        
class BotLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotLog
        fields = '__all__'
        read_only_fields = ('user_robot', 'timestamp')