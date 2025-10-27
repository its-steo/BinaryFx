from django.contrib import admin
from .models import ForexPair, Position, ForexTrade

@admin.register(ForexPair)
class ForexPairAdmin(admin.ModelAdmin):
    list_display = ('name', 'base_currency', 'quote_currency', 'pip_value')

@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ('user', 'pair', 'direction', 'volume_lots', 'entry_price', 'floating_p_l', 'status')
    list_filter = ('status', 'direction')

@admin.register(ForexTrade)
class ForexTradeAdmin(admin.ModelAdmin):
    list_display = ('position', 'close_price', 'realized_p_l', 'close_time')