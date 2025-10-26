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
        
class UserRobotListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_robots = UserRobot.objects.filter(user=request.user)
        
        try:
            # Check if user has a demo account
            Account.objects.get(user=request.user, account_type='demo')
            
            # Get demo-available robots not already owned
            available_robots = Robot.objects.filter(available_for_demo=True).exclude(
                id__in=user_robots.values_list('robot_id', flat=True)
            )
            
            # Serialize owned robots
            user_serializer = UserRobotSerializer(user_robots, many=True)
            
            # Create fake UserRobot instances for demo-available ones (to match serializer format)
            fake_user_robots = [
                UserRobot(user=request.user, robot=robot, purchased_at=None) for robot in available_robots
            ]
            fake_serializer = UserRobotSerializer(fake_user_robots, many=True)
            
            # Combine data
            combined_data = user_serializer.data + fake_serializer.data
            return Response(combined_data)
        
        except Account.DoesNotExist:
            # No demo account: only return owned robots
            serializer = UserRobotSerializer(user_robots, many=True)
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

        if amount < Decimal('0.5'):
            return Response({'error': 'Minimum trade amount is 0.5 USD'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'error': 'Amount must be positive'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            market = Market.objects.get(id=market_id)
            trade_type = TradeType.objects.get(id=trade_type_id)
            account = Account.objects.get(user=user, account_type=account_type)
            is_demo = account.account_type == 'demo'
            effective_sashi = user.is_sashi or is_demo

            used_robot = None
            if robot_id:
                robot = Robot.objects.get(id=robot_id)
                if is_demo:
                    if not robot.available_for_demo:
                        return Response({'error': 'Robot not available for demo'}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    UserRobot.objects.get(user=user, robot=robot)  # Check ownership for real
                used_robot = robot

            # Martingale setup
            martingale_mult = TradingSetting.get_instance().martingale_multiplier
            trades = []
            total_net_profit = Decimal('0.00')
            session_profit_before = Decimal('0.00')  # Could query sum of today's profits if needed

            # Calculate current amount for this level
            current_amount = amount * (martingale_mult ** martingale_level)

            if account.balance < current_amount:
                return Response({'error': 'Insufficient balance for this trade'}, status=status.HTTP_400_BAD_REQUEST)

            # Deduct stake instantly
            account.balance -= current_amount
            account.save()

            # Determine win probability (updated for realism)
            if use_martingale and not effective_sashi:
                win_prob = 0.1  # Keep 10% for non-Sashi with martingale
            elif used_robot:
                if effective_sashi:
                    # Base 80% for Sashi with robot; boost to 95% on martingale recovery levels
                    win_prob = 0.8 if martingale_level == 0 else 0.95
                else:
                    robot_wr = used_robot.win_rate
                    if robot_wr >= 90:
                        win_prob = 0.8  # Adjusted down for more realism, but still high
                    elif robot_wr >= 50:
                        win_prob = robot_wr / 100.0
                    else:
                        win_prob = 0.2  # Adjusted up to 20% for occasional wins
            else:
                if effective_sashi:
                    # Base 80% for Sashi; boost to 95% on martingale recovery levels
                    win_prob = 0.8 if martingale_level == 0 else 0.95
                else:
                    win_prob = 0.2  # Adjusted up to 20% for non-Sashi (occasional 1-2 wins, but more losses)

            # Simulate delay for realism (1-5s)
            time.sleep(random.uniform(1, 5))

            is_win = random.random() < win_prob

            # Simulate spots
            entry_spot = random.uniform(1.0, 100.0)
            delta = random.uniform(0.01, 0.1)
            if direction == 'buy':
                exit_spot = entry_spot + delta if is_win else entry_spot - delta
            else:
                exit_spot = entry_spot - delta if is_win else entry_spot + delta
            current_spot = exit_spot

            if is_win:
                gross_payout = current_amount * market.profit_multiplier
                net_profit = gross_payout - current_amount
                account.balance += gross_payout
            else:
                gross_payout = Decimal('0.00')
                net_profit = -current_amount

            account.save()

            total_net_profit = net_profit

            # Create Trade record
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
                session_profit_before=session_profit_before,
                is_demo=is_demo,
                entry_spot=Decimal(entry_spot).quantize(Decimal('0.00')),
                exit_spot=Decimal(exit_spot).quantize(Decimal('0.00')),
                current_spot=Decimal(current_spot).quantize(Decimal('0.00'))
            )
            trades.append(trade)

            # Create Transaction
            Transaction.objects.create(
                account=account,
                amount=net_profit,
                transaction_type='credit' if is_win else 'debit',
                description=f"{'Demo ' if is_demo else ''}Trade on {market.name}: {'Win' if is_win else 'Loss'} (Level {martingale_level})"
            )

            # No loop, so no internal stop_loss or target_profit checks; handled in frontend

            message = 'Trade completed.'

            return Response({
                'trades': TradeSerializer(trades, many=True).data,
                'total_profit': total_net_profit,
                'message': message,
                'is_demo': is_demo
            }, status=status.HTTP_201_CREATED)

        except (Market.DoesNotExist, TradeType.DoesNotExist, Account.DoesNotExist, Robot.DoesNotExist, UserRobot.DoesNotExist) as e:
            # Rollback current deduction on error
            current_amount = amount * (TradingSetting.get_instance().martingale_multiplier ** martingale_level)
            account.balance += current_amount
            account.save()
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            current_amount = amount * (TradingSetting.get_instance().martingale_multiplier ** martingale_level)
            account.balance += current_amount
            account.save()
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
             
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