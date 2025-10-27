# forex/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('pairs/', views.ForexPairListView.as_view(), name='forex_pairs'),  # Fixed from ForexPairView
    path('current-price/<int:pair_id>/', views.CurrentPriceView.as_view(), name='current_price'),
    path('current-prices/', views.CurrentPricesView.as_view(), name='current_prices'),
    path('orders/place/', views.PlaceOrderView.as_view(), name='place_order'),
    path('positions/', views.PositionListView.as_view(), name='positions'),
    path('positions/<int:position_id>/close/', views.ClosePositionView.as_view(), name='close_position'),
    path('positions/close-all/', views.CloseAllPositionsView.as_view(), name='close_all_positions'),
    path('history/', views.ForexTradeHistoryView.as_view(), name='trade_history'),
]