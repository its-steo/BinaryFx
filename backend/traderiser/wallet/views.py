# wallet/views.py
import random
import string
import json
import logging
from decimal import Decimal
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.http import JsonResponse
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from .models import Wallet, WalletTransaction, MpesaNumber, Currency, ExchangeRate, OTPCode
from .serializers import (
    WalletSerializer, WalletTransactionSerializer, MpesaNumberSerializer,
    OTPRequestSerializer, OTPVerifySerializer
)
from accounts.models import Account
from dashboard.models import Transaction
from .payment import PaymentClient
import logging

logger = logging.getLogger('wallet')
ADMIN_EMAIL = "trendxbinarytrading@gmail.com"

def generate_reference_id(length: int = 12) -> str:
    """Generate a random alphanumeric reference ID."""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP of given length."""
    return ''.join(random.choices(string.digits, k=length))

class WalletListView(APIView):
    def get(self, request):
        # Filter to user's wallets, but highlight active
        active_id = request.session.get('active_wallet_account_id')
        wallets = Wallet.objects.filter(account__user=request.user)
        serializer = WalletSerializer(wallets, many=True)
        active_wallet = wallets.filter(account_id=active_id).first() if active_id else None
        return Response({
            'wallets': serializer.data,
            'active_balance': active_wallet.balance if active_wallet else Decimal('0.00')
        })
    
class MpesaNumberView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            mpesa = MpesaNumber.objects.get(user=request.user)
            return Response(MpesaNumberSerializer(mpesa).data)
        except MpesaNumber.DoesNotExist:
            return Response({'error': 'M-Pesa number not set'}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        serializer = MpesaNumberSerializer(data=request.data)
        if serializer.is_valid():
            mpesa, _ = MpesaNumber.objects.update_or_create(
                user=request.user,
                defaults={'phone_number': serializer.validated_data['phone_number']}
            )
            return Response(MpesaNumberSerializer(mpesa).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

logger = logging.getLogger('wallet')
ADMIN_EMAIL = "trendxbinarytrading@gmail.com"  # or get from settings

class DepositView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data
        account_type = data.get('account_type', 'standard')
        wallet_type = data.get('wallet_type', 'main')
        amount = Decimal(data.get('amount'))
        incoming_currency_code = data.get('currency', 'KSH').upper()
        mpesa_phone = data.get('mpesa_phone')

        try:
            incoming_currency = Currency.objects.get(code=incoming_currency_code)
            wallet_currency = Currency.objects.get(code='USD')
            account, _ = Account.objects.get_or_create(user=request.user, account_type=account_type)
            wallet, _ = Wallet.objects.get_or_create(
                account=account, wallet_type=wallet_type, currency=wallet_currency,
                defaults={'balance': Decimal('0.00')}
            )
        except Currency.DoesNotExist:
            return Response({'error': 'Currency not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            exchange_rate_obj = ExchangeRate.objects.get(
                base_currency=wallet_currency,
                target_currency=incoming_currency
            )
            exchange_rate = exchange_rate_obj.live_rate
            converted_amount = amount / exchange_rate
        except ExchangeRate.DoesNotExist:
            return Response({'error': 'Exchange rate not available'}, status=status.HTTP_400_BAD_REQUEST)

        reference_id = generate_reference_id()

        trans = WalletTransaction.objects.create(
            wallet=wallet,
            transaction_type='deposit',
            amount=amount,
            currency=incoming_currency,
            target_currency=wallet_currency,
            converted_amount=converted_amount,
            exchange_rate_used=exchange_rate,
            status='pending',
            reference_id=reference_id,
            description='M-Pesa STK Push initiated',
            mpesa_phone=mpesa_phone
        )

        payment_client = PaymentClient()
        stk_response = payment_client.initiate_stk_push(mpesa_phone, amount, reference_id)

        if 'CheckoutRequestID' in stk_response:
            trans.checkout_request_id = stk_response['CheckoutRequestID']
            trans.save()

            # SEND EMAIL TO ADMIN IMMEDIATELY
            try:
                send_mail(
                    subject="New Deposit Request – STK Push Sent",
                    message=(
                        f"User: {request.user.username}\n"
                        f"Email: {request.user.email}\n"
                        f"Amount: {amount} {incoming_currency.code}\n"
                        f"Converted: ~{converted_amount:.2f} USD\n"
                        f"Phone: {mpesa_phone}\n"
                        f"Account Type: {account_type.title()}\n"
                        f"Reference: {reference_id}\n"
                        f"Time: {timezone.now().strftime('%Y-%m-%d %H:%M %Z')}\n\n"
                        f"User has been prompted to enter PIN. Awaiting completion."
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[ADMIN_EMAIL],
                    fail_silently=False,
                )
            except Exception as e:
                logger.error(f"Failed to send admin deposit email for {reference_id}: {e}")

            return Response({
                'message': 'STK Push initiated successfully',
                'reference_id': reference_id
            })
        else:
            trans.status = 'failed'
            trans.description = stk_response.get('error', 'STK Push failed')
            trans.save()
            return Response({'error': 'Failed to initiate STK Push'}, status=status.HTTP_400_BAD_REQUEST)
        
class WithdrawalOTPView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        amount = data['amount']
        wallet_type = data['wallet_type']
        account_type = data['account_type']

        try:
            account, _ = Account.objects.get_or_create(user=request.user, account_type=account_type)
            currency = Currency.objects.get(code='USD')
            target_currency = Currency.objects.get(code='KSH')
            wallet, _ = Wallet.objects.get_or_create(account=account, wallet_type=wallet_type, currency=currency, defaults={'balance': Decimal('0.00')})
        except Currency.DoesNotExist:
            return Response({'error': 'Currency not found'}, status=status.HTTP_404_NOT_FOUND)

        if wallet.balance < amount:
            return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            exchange_rate_obj = ExchangeRate.objects.get(
                base_currency=wallet.currency,
                target_currency=target_currency
            )
            exchange_rate = exchange_rate_obj.admin_withdrawal_rate
            converted_amount = amount * exchange_rate
        except ExchangeRate.DoesNotExist:
            return Response({'error': 'Exchange rate not available'}, status=status.HTTP_400_BAD_REQUEST)

        reference_id = generate_reference_id()
        trans = WalletTransaction.objects.create(
            wallet=wallet,
            transaction_type='withdrawal',
            amount=amount,
            currency=wallet.currency,
            target_currency=target_currency,
            converted_amount=converted_amount,
            exchange_rate_used=exchange_rate,
            status='pending',
            reference_id=reference_id,
            description='Withdrawal initiated',
            mpesa_phone=request.user.mpesa_number.phone_number if hasattr(request.user, 'mpesa_number') else ''
        )

        otp_code = generate_otp()
        OTPCode.objects.create(
            user=request.user,
            code=otp_code,
            purpose='withdrawal',
            transaction=trans
        )

        try:
            send_mail(
                "Withdrawal OTP",
                f"Hi {request.user.username},\n\nYour OTP for withdrawing {amount} USD from {account_type} account (Ref: {reference_id}) is {otp_code}.",
                settings.DEFAULT_FROM_EMAIL,
                [request.user.email],
                fail_silently=False
            )
        except Exception as e:
            logger.error(f"Failed to send OTP email: {str(e)}")
            return Response({'error': 'Failed to send OTP email'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'message': 'OTP sent to your email',
            'transaction_id': trans.id
        })

class VerifyWithdrawalOTPView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        code = serializer.validated_data['code']
        transaction_id = serializer.validated_data['transaction_id']

        try:
            trans = WalletTransaction.objects.get(
                id=transaction_id,
                wallet__account__user=request.user,
                status='pending'
            )
            otp = OTPCode.objects.get(
                user=request.user,
                code=code,
                purpose='withdrawal',
                transaction=trans,
                is_used=False
            )
            if otp.is_expired():
                return Response({'error': 'OTP expired'}, status=status.HTTP_400_BAD_REQUEST)
        except (WalletTransaction.DoesNotExist, OTPCode.DoesNotExist):
            return Response({'error': 'Invalid OTP or transaction'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Mark OTP as used
            otp.is_used = True
            otp.save()

            # Deduct balance immediately
            wallet = trans.wallet
            wallet.balance -= trans.amount
            wallet.save()

            # Update transaction
            trans.status = 'pending'  # still pending admin approval
            trans.completed_at = timezone.now()
            trans.description = 'Withdrawal Successful'
            trans.save()

            # Log in dashboard
            Transaction.objects.create(
                account=wallet.account,
                amount=-trans.amount,
                transaction_type='withdrawal',
                description=f"Pending: {trans.reference_id}"
            )

        # --- SEND EMAIL TO ADMIN ---
        try:
            send_mail(
                subject="Withdrawal Ready for Payout",
                message=(
                    f"User: {request.user.username}\n"
                    f"Email: {request.user.email}\n"
                    f"Amount: {trans.amount} USD → {trans.converted_amount} KSH\n"
                    f"Phone: {trans.mpesa_phone}\n"
                    f"Account: {wallet.account.account_type.title()}\n"
                    f"Reference: {trans.reference_id}\n"
                    f"Time: {timezone.now().strftime('%Y-%m-%d %H:%M %Z')}\n\n"
                    f"OTP verified. Funds deducted. Please send money via M-Pesa."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[ADMIN_EMAIL],
                fail_silently=False,
            )
        except Exception as e:
            logger.error(f"Failed to send admin withdrawal email for {trans.reference_id}: {e}")

        # --- SEND USER CONFIRMATION (optional, but clean) ---
        send_mail(
            subject="Withdrawal Initiated",
            message=(
                f"Hi {request.user.username},\n\n"
                f"Your withdrawal of {trans.amount} USD ({trans.converted_amount} KSH)\n"
                f"has been initiated and is being processed.\n\n"
                f"Reference: {trans.reference_id}\n"
                f"You will receive the funds shortly."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[request.user.email],
            fail_silently=True,
        )

        return Response({
            'message': 'Withdrawal initiated successfully'
        })

class TransactionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        transactions = WalletTransaction.objects.filter(wallet__account__user=request.user).order_by('-created_at')
        serializer = WalletTransactionSerializer(transactions, many=True)
        return Response(serializer.data)

class MpesaCallbackView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        logger.info(f"Callback received: {request.data}")
        try:
            stk = request.data.get('Body', {}).get('stkCallback', {})
            if not stk:
                return JsonResponse({'ResultCode': 1, 'ResultDesc': 'Invalid payload'})

            checkout_id = stk['CheckoutRequestID']
            trans = WalletTransaction.objects.filter(checkout_request_id=checkout_id).first()
            if not trans:
                return JsonResponse({'ResultCode': 1, 'ResultDesc': 'Transaction not found'})

            if stk['ResultCode'] == 0:
                items = stk['CallbackMetadata']['Item']
                amount = next((item['Value'] for item in items if item['Name'] == 'Amount'), None)
                receipt = next((item['Value'] for item in items if item['Name'] == 'MpesaReceiptNumber'), None)
                trans.amount = Decimal(amount) if amount else trans.amount
                trans.description = f"Completed: {receipt}"
                trans.status = 'completed'
                trans.completed_at = timezone.now()
                trans.save()

                wallet = trans.wallet
                wallet.balance += trans.converted_amount
                wallet.save()

                Transaction.objects.create(
                    account=wallet.account,
                    amount=trans.converted_amount,
                    transaction_type='deposit',
                    description=f"Approved: {trans.reference_id}"
                )
                user = trans.wallet.account.user
                try:
                    send_mail(
                        "Deposit Approved!",
                        f"Hi {user.username},\n\nYour deposit of KSh {trans.amount} has been approved.\n${trans.converted_amount} USD credited to {wallet.account.account_type} account.\nRef: {trans.reference_id}",
                        settings.DEFAULT_FROM_EMAIL,
                        [user.email],
                        fail_silently=False
                    )
                    send_mail(
                        "Deposit Completed (Auto)",
                        f"User: {user.username}\nAmount: KSh {trans.amount} (${trans.converted_amount})\nAccount: {wallet.account.account_type}\nRef: {trans.reference_id}",
                        settings.DEFAULT_FROM_EMAIL,
                        [ADMIN_EMAIL],
                        fail_silently=False
                    )
                except Exception as e:
                    logger.error(f"Failed to send deposit emails for {trans.reference_id}: {str(e)}")
            else:
                trans.status = 'failed'
                trans.description += f' | Failed: {stk["ResultDesc"]}'
                trans.save()
                user = trans.wallet.account.user
                try:
                    send_mail(
                        "Deposit Failed",
                        f"Hi {user.username},\n\nYour deposit of KSh {trans.amount} to {trans.wallet.account.account_type} account failed: {stk['ResultDesc']}.\nRef: {trans.reference_id}",
                        settings.DEFAULT_FROM_EMAIL,
                        [user.email],
                        fail_silently=False
                    )
                except Exception as e:
                    logger.error(f"Failed to send deposit failure email for {trans.reference_id}: {str(e)}")
        except Exception as e:
            logger.error(f"Callback error: {e}")
        return JsonResponse({'ResultCode': 0})

class ResendOTPView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not isinstance(request.data, dict):
            return Response(
                {'error': 'Invalid payload. Expected JSON object with "transaction_id" key'},
                status=status.HTTP_400_BAD_REQUEST
            )

        transaction_id = request.data.get('transaction_id')
        if not transaction_id:
            return Response(
                {'error': 'transaction_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            transaction_id = int(transaction_id)
            wallet_transaction = WalletTransaction.objects.get(
                id=transaction_id,
                wallet__account__user=request.user,
                status='pending'
            )
        except ValueError:
            return Response(
                {'error': 'transaction_id must be a valid integer'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except WalletTransaction.DoesNotExist:
            return Response(
                {'error': 'Invalid or non-pending transaction'},
                status=status.HTTP_400_BAD_REQUEST
            )

        otp_code = generate_otp()
        with transaction.atomic():
            # Delete existing OTPCode for this transaction
            OTPCode.objects.filter(transaction=wallet_transaction).delete()
            # Create new OTPCode
            OTPCode.objects.create(
                user=request.user,
                code=otp_code,
                purpose='withdrawal',
                transaction=wallet_transaction,
                is_used=False
            )

        try:
            send_mail(
                subject="Withdrawal OTP (Resent)",
                message=f"Hi {request.user.username},\n\nYour new OTP for withdrawing {wallet_transaction.amount} USD from {wallet_transaction.wallet.account.account_type} account (Ref: {wallet_transaction.reference_id}) is {otp_code}.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[request.user.email],
                fail_silently=False
            )
        except Exception as e:
            logger.error(f"Failed to send resent OTP email for user {request.user.id}: {str(e)}")
            return Response(
                {'error': 'Failed to send OTP email'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({'message': 'New OTP sent to your email.'}, status=status.HTTP_200_OK)