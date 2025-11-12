# management/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db import transaction
from decimal import Decimal
from .models import ManagementRequest
from .serializers import ManagementRequestSerializer, InitiateManagementSerializer
from wallet.models import WalletTransaction
from wallet.payment import PaymentClient
from django.conf import settings
import logging

logger = logging.getLogger('management')


class InitiateManagementView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = InitiateManagementSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        stake = serializer.validated_data['stake']
        target_profit = serializer.validated_data['target_profit']
        mpesa_phone = serializer.validated_data['mpesa_phone']
        payment_amount = target_profit * Decimal('0.20')

        # Initiate STK Push
        client = PaymentClient()
        response = client.initiate_stk_push(
            phone_number=mpesa_phone,
            amount=float(payment_amount),
            transaction_id=f"MGMT-{request.user.id}-{int(payment_amount)}"
        )

        if response.get('ResponseCode') != '0':
            return Response({'error': 'STK Push failed'}, status=status.HTTP_400_BAD_REQUEST)

        # Create pending transaction + management request
        with transaction.atomic():
            trans = WalletTransaction.objects.create(
                wallet=request.user.accounts.first().wallets.get(wallet_type='main', currency__code='USD'),
                transaction_type='deposit',
                amount=payment_amount,
                currency__code='KSH',
                mpesa_phone=mpesa_phone,
                reference_id=response.get('MerchantRequestID'),
                checkout_request_id=response.get('CheckoutRequestID'),
                status='pending'
            )
            mgmt = ManagementRequest.objects.create(
                user=request.user,
                stake=stake,
                target_profit=target_profit,
                payment_amount=payment_amount,
                mpesa_phone=mpesa_phone,
                payment_transaction=trans
            )

        return Response({
            'management_id': mgmt.management_id,
            'payment_amount': payment_amount,
            'message': 'STK Push sent. Await admin verification.'
        }, status=status.HTTP_201_CREATED)


class SubmitCredentialsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        mgmt_id = request.data.get('management_id')
        email = request.data.get('account_email')
        password = request.data.get('account_password')

        try:
            mgmt = ManagementRequest.objects.get(
                management_id=mgmt_id, user=request.user, status='payment_verified'
            )
            mgmt.account_email = email
            mgmt.account_password = password
            mgmt.status = 'credentials_pending'
            mgmt.save()
            return Response({'message': 'Credentials saved'}, status=status.HTTP_200_OK)
        except ManagementRequest.DoesNotExist:
            return Response({'error': 'Invalid request'}, status=status.HTTP_400_BAD_REQUEST)


class ManagementStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        requests = ManagementRequest.objects.filter(user=request.user)
        serializer = ManagementRequestSerializer(requests, many=True)
        return Response(serializer.data)