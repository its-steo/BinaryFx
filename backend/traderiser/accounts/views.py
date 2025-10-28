# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User, Account
from .serializers import UserSerializer, AccountSerializer
from django.conf import settings
from django.db import transaction


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]  # PUBLIC

    def post(self, request):
        data = request.data
        email = data.get('email')
        password = data.get('password')
        username = data.get('username')
        account_type = data.get('account_type', 'standard')
        phone = data.get('phone', '')

        # Validate required fields
        if not email or not password or not username:
            return Response(
                {'error': 'Email, password, and username are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Try to find existing user
        try:
            user = User.objects.get(email=email)
            if not user.check_password(password):
                return Response(
                    {'error': 'Invalid password'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            if not user.can_create_account(account_type):
                return Response(
                    {'error': 'Cannot create this account type'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                Account.objects.create(user=user, account_type=account_type)

        except User.DoesNotExist:
            # New user
            serializer = UserSerializer(data={'email': email, 'username': username, 'phone': phone})
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                user = serializer.save()
                user.set_password(password)
                user.save()
                # Auto-create demo + standard accounts
                Account.objects.create(user=user, account_type='demo')
                Account.objects.create(user=user, account_type='standard')

        # Authenticate the user to ensure they are valid
        user = authenticate(request=request, username=email, password=password)
        if not user:
            return Response(
                {'error': 'Authentication failed after account creation'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        active_account = user.accounts.filter(account_type=account_type).first() or user.accounts.get(account_type='standard')

        return Response(
            {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data,
                'active_account': AccountSerializer(active_account).data
            },
            status=status.HTTP_201_CREATED
        )
        
class CreateAdditionalAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        account_type = request.data.get('account_type')
        if account_type != 'pro-fx':
            return Response({'error': 'Only pro-fx allowed'}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.can_create_account('pro-fx'):
            return Response({'error': 'Cannot create pro-fx'}, status=status.HTTP_400_BAD_REQUEST)

        account = Account.objects.create(user=request.user, account_type='pro-fx')
        return Response({
            'message': 'Pro-FX account created',
            'active_account': AccountSerializer(account).data
        }, status=status.HTTP_201_CREATED)
        
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]  # PUBLIC

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        account_type = request.data.get('account_type', 'standard')

        if not email or not password:
            return Response({'error': 'Email and password required'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=email, password=password)
        if not user:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            account = user.accounts.get(account_type=account_type)
        except Account.DoesNotExist:
            return Response({'error': f'No {account_type} account found'}, status=status.HTTP_400_BAD_REQUEST)

        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data,
            'active_account': AccountSerializer(account).data
        })
    
class SashiToggleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        account_type = request.data.get('account_type', 'standard')
        try:
            account = Account.objects.get(user=request.user, account_type=account_type)
            if account.account_type in ['demo', 'pro-fx']:
                return Response({'error': 'Demo or Pro-FX accounts cannot toggle Sashi status'}, status=status.HTTP_400_BAD_REQUEST)
            user = request.user
            user.is_sashi = not user.is_sashi
            user.save()
            return Response({'is_sashi': user.is_sashi}, status=status.HTTP_200_OK)
        except Account.DoesNotExist:
            return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

class AccountDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = UserSerializer(user)
        # Include active wallet in response (default to main real account if exists, else demo)
        active_wallet = request.session.get('active_wallet_account_id')
        active_account = None
        if active_wallet:
            try:
                active_account = Account.objects.get(id=active_wallet, user=user)
            except Account.DoesNotExist:
                pass
        if not active_account:
            active_account = user.accounts.exclude(account_type='demo').first() or user.accounts.first()
        return Response({
            'user': serializer.data,
            'active_account': AccountSerializer(active_account).data if active_account else None
        }, status=status.HTTP_200_OK)

class ResetDemoBalanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            account = Account.objects.get(user=request.user, account_type='demo')
            account.reset_demo_balance()
            from dashboard.models import Transaction
            Transaction.objects.filter(account=account).delete()
            return Response({
                'balance': account.balance,
                'message': 'Demo balance reset to 10,000 USD'
            }, status=status.HTTP_200_OK)
        except Account.DoesNotExist:
            return Response({'error': 'Demo account not found'}, status=status.HTTP_404_NOT_FOUND)

class SwitchWalletView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        account_id = request.data.get('account_id')
        try:
            account = Account.objects.get(id=account_id, user=request.user)
            if account.account_type == 'demo':
                return Response({'error': 'Cannot switch to demo via API'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({
                'message': 'Switched',
                'active_account': AccountSerializer(account).data
            })
        except Account.DoesNotExist:
            return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)