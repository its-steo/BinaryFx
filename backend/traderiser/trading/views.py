import time
import random
from decimal import Decimal
from datetime import date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import Market, TradeType, Robot, UserRobot, TradingSetting, Trade
from .serializers import MarketSerializer, TradeTypeSerializer, RobotSerializer, UserRobotSerializer, TradeSerializer
from accounts.models import Account
from dashboard.models import Transaction
from decimal import Decimal, InvalidOperation
from django.db.models import Max

class MarketListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        markets = Market.objects.all()
        serializer = MarketSerializer(markets, many=True)
        return Response(serializer.data)

class TradeTypeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        trade_types = TradeType.objects.all()
        serializer = TradeTypeSerializer(trade_types, many=True)
        return Response(serializer.data)

class RobotListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        robots = Robot.objects.all()
        serializer = RobotSerializer(robots, many=True)
        return Response(serializer.data)

class PurchaseRobotView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, robot_id):  # Add robot_id parameter
        account_type = request.data.get('account_type', 'standard')
        try:
            robot = Robot.objects.get(id=robot_id)
            account = Account.objects.get(user=request.user, account_type=account_type)
            if account.account_type == 'demo':
                if robot.available_for_demo:
                    UserRobot.objects.get_or_create(user=request.user, robot=robot)
                    return Response({'message': 'Robot assigned for demo use'}, status=status.HTTP_200_OK)
                return Response({'error': 'This robot is not available for demo accounts'}, status=status.HTTP_400_BAD_REQUEST)
            if account.balance < robot.price:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            account.balance -= robot.price
            account.save()
            Transaction.objects.create(
                account=account,
                amount=-robot.price,
                transaction_type='debit',
                description=f'Purchased robot: {robot.name}'
            )
            UserRobot.objects.create(user=request.user, robot=robot)
            return Response({'message': 'Robot purchased successfully'}, status=status.HTTP_201_CREATED)
        except Robot.DoesNotExist:
            return Response({'error': 'Robot not found'}, status=status.HTTP_404_NOT_FOUND)
        except Account.DoesNotExist:
            return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)
        
# trading/views.py → replace ONLY the UserRobotListView
class UserRobotListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # 1. Check if user is in DEMO mode
        is_demo = Account.objects.filter(user=user, account_type='demo').exists()

        if is_demo:
            # DEMO: Show ALL robots with available_for_demo=True
            # (even if not purchased — they get fake UserRobot with purchased_at=None)
            demo_robots = Robot.objects.filter(available_for_demo=True)
            fake_entries = []
            fake_id = UserRobot.objects.aggregate(Max('id'))['id__max'] or 0
            fake_id += 1

            for robot in demo_robots:
                # Only create fake if not already owned
                if not UserRobot.objects.filter(user=user, robot=robot).exists():
                    fake = UserRobot(
                        id=fake_id,
                        user=user,
                        robot=robot,
                        purchased_at=None
                    )
                    fake_entries.append(fake)
                    fake_id += 1

            real_entries = UserRobot.objects.filter(user=user)
            combined = list(real_entries) + fake_entries
            serializer = UserRobotSerializer(combined, many=True)
        else:
            # REAL ACCOUNT: ONLY show purchased robots
            owned = UserRobot.objects.filter(user=user)
            serializer = UserRobotSerializer(owned, many=True)

        return Response(serializer.data)
        return Response(serializer.data)
        
# trading/views.py (relevant part: PlaceTradeView)
class PlaceTradeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        user = request.user
        market_id = data.get('market_id')
        trade_type_id = data.get('trade_type_id')
        direction = data.get('direction')  # 'buy' or 'sell'
        amount = Decimal(data.get('amount'))
        use_martingale = data.get('use_martingale', False)
        martingale_level = data.get('martingale_level', 0)
        robot_id = data.get('robot_id')
        account_type = data.get('account_type', 'standard')
        target_profit = data.get('target_profit')
        stop_loss = data.get('stop_loss')

        # === Validate optional target_profit / stop_loss ===
        if target_profit is not None:
            try:
                target_profit = Decimal(target_profit)
            except:
                return Response({'error': 'Invalid target profit'}, status=status.HTTP_400_BAD_REQUEST)
        
        if stop_loss is not None:
            try:
                stop_loss = Decimal(stop_loss)
            except:
                return Response({'error': 'Invalid stop loss'}, status=status.HTTP_400_BAD_REQUEST)

        # === Amount validation ===
        if amount < Decimal('0.5'):
            return Response({'error': 'Minimum trade amount is 0.5 USD'}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({'error': 'Amount must be positive'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # === Fetch core objects ===
            market = Market.objects.get(id=market_id)
            trade_type = TradeType.objects.get(id=trade_type_id)
            account = Account.objects.get(user=user, account_type=account_type)
            is_demo = account.account_type == 'demo'
            effective_sashi = user.is_sashi or is_demo  # DEMO = FULL SASHI

            # === Robot validation ===
            used_robot = None
            if robot_id:
                robot = Robot.objects.get(id=robot_id)
                if is_demo:
                    if not robot.available_for_demo:
                        return Response({'error': 'Robot not available for demo'}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    UserRobot.objects.get(user=user, robot=robot)  # Must own it
                used_robot = robot

            # === Martingale setup ===
            martingale_mult = TradingSetting.get_instance().martingale_multiplier
            current_amount = amount * (martingale_mult ** martingale_level)

            if account.balance < current_amount:
                return Response({'error': 'Insufficient balance for this trade'}, status=status.HTTP_400_BAD_REQUEST)

            # === Deduct stake ===
            account.balance -= current_amount
            account.save()

            # === WIN PROBABILITY: ROBOT FIRST ===
            if used_robot:
                robot_rate = used_robot.win_rate / 100.0
                if robot_rate >= 0.90:
                    win_prob = 0.90  # Elite robot → 90% win for ANYONE
                else:
                    win_prob = robot_rate  # Exact robot rate (Sashi ignored)
            else:
                # === NO ROBOT: SASHI / NON-SASHI LOGIC ===
                if effective_sashi:
                    win_prob = 0.80 if martingale_level == 0 else 0.95
                else:
                    win_prob = 0.20

            # === NON-SASHI MARTINGALE PENALTY (ONLY IF NO ROBOT) ===
            if use_martingale and not effective_sashi and not used_robot:
                win_prob = 0.10

            # === Simulate trade outcome ===
            time.sleep(random.uniform(1, 5))  # Realism delay
            is_win = random.random() < win_prob

            # === Simulate price movement ===
            entry_spot = random.uniform(1.0, 100.0)
            delta = random.uniform(0.01, 0.1)
            if direction == 'buy':
                exit_spot = entry_spot + delta if is_win else entry_spot - delta
            else:
                exit_spot = entry_spot - delta if is_win else entry_spot + delta
            current_spot = exit_spot

            # === Payout calculation ===
            if is_win:
                gross_payout = current_amount * market.profit_multiplier
                net_profit = gross_payout - current_amount
                account.balance += gross_payout
            else:
                gross_payout = Decimal('0.00')
                net_profit = -current_amount

            account.save()

            # === Create Trade record ===
            trade = Trade.objects.create(
                user=user,
                account=account,
                market=market,
                trade_type=trade_type,
                direction=direction,
                amount=current_amount,
                is_win=is_win,
                profit=net_profit,
                used_martingale=use_martingale and martingale_level > 0,
                martingale_level=martingale_level,
                used_robot=used_robot,
                session_profit_before=Decimal('0.00'),
                is_demo=is_demo,
                entry_spot=Decimal(entry_spot).quantize(Decimal('0.00')),
                exit_spot=Decimal(exit_spot).quantize(Decimal('0.00')),
                current_spot=Decimal(current_spot).quantize(Decimal('0.00'))
            )

            # === Create Transaction log ===
            Transaction.objects.create(
                account=account,
                amount=net_profit,
                transaction_type='credit' if is_win else 'debit',
                description=f"{'Demo ' if is_demo else ''}Trade on {market.name}: {'Win' if is_win else 'Loss'} (Level {martingale_level})"
            )

            return Response({
                'trades': TradeSerializer([trade], many=True).data,
                'total_profit': net_profit,
                'message': 'Trade completed.',
                'is_demo': is_demo
            }, status=status.HTTP_201_CREATED)

        # === ERROR HANDLING WITH ROLLBACK ===
        except (Market.DoesNotExist, TradeType.DoesNotExist, Account.DoesNotExist,
                Robot.DoesNotExist, UserRobot.DoesNotExist) as e:
            if 'account' in locals():
                account.balance += current_amount
                account.save()
            return Response({'error': 'Resource not found'}, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            if 'account' in locals():
                account.balance += current_amount
                account.save()
            return Response({'error': 'Trade failed'}, status=status.HTTP_400_BAD_REQUEST)
             
class TradeHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            params = request.query_params
            trades = Trade.objects.filter(user=request.user)
            
            if 'asset_id' in params:
                trades = trades.filter(market_id=params['asset_id'])
            if 'account_type' in params:
                trades = trades.filter(account__account_type=params['account_type'])
            if 'is_demo' in params:
                trades = trades.filter(is_demo=params['is_demo'].lower() == 'true')

            serializer = TradeSerializer(trades, many=True)
            # Calculate total session profit for the day
            today = date.today()
            session_trades = trades.filter(timestamp__date=today)
            total_session_profit = sum(trade.profit for trade in session_trades)
            return Response({
                'trades': serializer.data,
                'total_session_profit': total_session_profit
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        

class ResetDemoBalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            demo_account = Account.objects.get(user=request.user, account_type='demo')
            demo_account.balance = Decimal('10000.00')
            demo_account.save()
            Transaction.objects.create(
                account=demo_account,
                amount=Decimal('10000.00'),
                transaction_type='credit',
                description='Demo balance reset'
            )
            return Response({'message': 'Demo balance reset to $10,000'}, status=status.HTTP_200_OK)
        except Account.DoesNotExist:
            return Response({'error': 'Demo account not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)