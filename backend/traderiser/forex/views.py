# forex/views.py
import random
from decimal import Decimal
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import ForexPair, Position, ForexTrade
from .serializers import ForexPairSerializer, PositionSerializer, ForexTradeSerializer
from accounts.models import Account
from wallet.models import Wallet, Currency
from dashboard.models import Transaction
from django.db import transaction
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator

logger = logging.getLogger(__name__)

class ForexPairListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.accounts.filter(account_type='pro-fx').exists():
            return Response(
                {'error': 'Pro-FX account required'},
                status=status.HTTP_403_FORBIDDEN
            )
        pairs = ForexPair.objects.all()
        serializer = ForexPairSerializer(pairs, many=True)
        return Response({'pairs': serializer.data})

class PlaceOrderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not request.user.accounts.filter(account_type='pro-fx').exists():
            return Response(
                {'error': 'Pro-FX account required'},
                status=status.HTTP_403_FORBIDDEN
            )

        pair_id = request.data.get('pair_id')
        direction = request.data.get('direction')  # 'buy' or 'sell'
        volume_lots = Decimal(request.data.get('volume_lots', '0.01'))
        sl = request.data.get('sl')
        tp = request.data.get('tp')
        time_frame = request.data.get('time_frame', 'M1')  # Default to 1 minute

        try:
            pair = ForexPair.objects.get(id=pair_id)
            account = request.user.accounts.get(account_type='pro-fx')

            # Simulated entry price
            entry_price = pair.get_current_price(time_frame=time_frame)
            if entry_price <= 0:
                return Response(
                    {'error': 'Failed to generate price'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Calculate margin
            margin = (volume_lots * pair.contract_size * entry_price) / 500  # Using leverage 500
            usd = Currency.objects.get(code='USD')
            wallet = Wallet.objects.get(account=account, wallet_type='main', currency=usd)

            # Check account balance before placing trade
            if wallet.balance < margin:
                return Response(
                    {'error': 'Insufficient balance for margin'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create the position
            with transaction.atomic():
                position = Position.objects.create(
                    user=request.user,
                    account=account,
                    pair=pair,
                    direction=direction,
                    volume_lots=volume_lots,
                    entry_price=entry_price,
                    sl=sl,
                    tp=tp,
                    floating_p_l=Decimal('0.00'),
                    status='open',
                    leverage=500,
                    time_frame=time_frame
                )

                wallet.balance -= margin
                wallet.save()
                Transaction.objects.create(
                    account=account,
                    amount=-margin,
                    transaction_type='margin_lock',
                    description=f'Forex open: {pair.name}'
                )

            serializer = PositionSerializer(position)
            return Response({'position': serializer.data}, status=status.HTTP_201_CREATED)

        except ForexPair.DoesNotExist:
            return Response({'error': 'Pair not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ----------------------------------------------------------------------
# 3. List open positions
# ----------------------------------------------------------------------
class PositionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.accounts.filter(account_type='pro-fx').exists():
            return Response(
                {'error': 'Pro-FX account required'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Update floating P&L for all open positions
        positions = Position.objects.filter(user=request.user, status='open')
        for pos in positions:
            current_price = pos.pair.get_current_price()
            pos.update_floating_p_l(current_price)
            # Auto close checks (SL/TP)
            if pos.sl and ((pos.direction == 'buy' and current_price <= pos.sl) or (pos.direction == 'sell' and current_price >= pos.sl)):
                pos.close_position(current_price, is_auto=True, close_reason='sl')
            elif pos.tp and ((pos.direction == 'buy' and current_price >= pos.tp) or (pos.direction == 'sell' and current_price <= pos.tp)):
                pos.close_position(current_price, is_auto=True, close_reason='tp')

        serializer = PositionSerializer(positions, many=True)
        return Response({'positions': serializer.data})  # Wrapped in {'positions': [...]}

# ----------------------------------------------------------------------
# 4. Manually close a position
# ----------------------------------------------------------------------
class ClosePositionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, position_id):
        if not request.user.accounts.filter(account_type='pro-fx').exists():
            return Response(
                {'error': 'Pro-FX account required'},
                status=status.HTTP_403_FORBIDDEN
            )
        try:
            position = Position.objects.get(id=position_id, user=request.user, status='open')
            current_price = position.pair.get_current_price(
                position.entry_time,
                is_sashi=request.user.is_sashi,
                direction=position.direction
            )
            position.close_position(current_price, is_auto=False, close_reason='manual')
            return Response({'message': 'Position closed successfully'}, status=status.HTTP_200_OK)
        except Position.DoesNotExist:
            return Response({'error': 'Position not found or already closed'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"ClosePositionView error for position {position_id}: {str(e)}")
            return Response({'error': 'Failed to close position'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ----------------------------------------------------------------------
# 5. Trade history
# ----------------------------------------------------------------------
class ForexTradeHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.accounts.filter(account_type='pro-fx').exists():
            return Response(
                {'error': 'Pro-FX account required'},
                status=status.HTTP_403_FORBIDDEN
            )
        trades = ForexTrade.objects.filter(position__user=request.user)
        serializer = ForexTradeSerializer(trades, many=True)
        return Response({'trades': serializer.data})  # Wrapped in {'trades': [...]}

# ----------------------------------------------------------------------
# 6. Helper – get the **simulated** current price for a single pair
# ----------------------------------------------------------------------
class CurrentPriceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pair_id):
        if not request.user.accounts.filter(account_type='pro-fx').exists():
            return Response(
                {'error': 'Pro-FX required'},
                status=status.HTTP_403_FORBIDDEN
            )
        try:
            pair = ForexPair.objects.get(id=pair_id)
        except ForexPair.DoesNotExist:
            return Response(
                {'error': 'Pair not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        price = pair.get_current_price()
        return Response({'current_price': float(price)})

class CurrentPricesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @method_decorator(cache_page(1))
    def get(self, request):
        if not request.user.accounts.filter(account_type='pro-fx').exists():
            return Response(
                {'error': 'Pro-FX account required'},
                status=status.HTTP_403_FORBIDDEN
            )
        ids_str = request.query_params.get('ids', '')
        if not ids_str:
            return Response(
                {'error': 'ids parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            pair_ids = [int(id.strip()) for id in ids_str.split(',') if id.strip().isdigit()]
            if not pair_ids:
                return Response(
                    {'error': 'No valid pair IDs provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            pairs = ForexPair.objects.filter(id__in=pair_ids)
            if len(pairs) != len(pair_ids):
                return Response(
                    {'error': 'Some pairs not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            prices = {}
            for pair in pairs:
                prices[pair.id] = float(pair.get_current_price())
            return Response({'prices': prices})
        except ValueError:
            return Response(
                {'error': 'Invalid ids format'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class CloseAllPositionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        positions = Position.objects.filter(user=request.user, status='open')
        if not positions.exists():
            return Response({'message': 'No open positions to close'}, status=status.HTTP_200_OK)
        
        with transaction.atomic():
            for position in positions:
                current_price = position.pair.get_current_price(
                    position.entry_time,
                    is_sashi=request.user.is_sashi,
                    direction=position.direction
                )
                position.close_position(current_price, is_auto=False, close_reason='manual')
        
        return Response({'message': 'All positions closed successfully'}, status=status.HTTP_200_OK)