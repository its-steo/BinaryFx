# customercare/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from django.utils.html import strip_tags
from .models import ChatThread, Message
import logging

User = get_user_model()
logger = logging.getLogger('customercare')

@receiver(post_save, sender=User)
def create_support_thread(sender, instance, created, **kwargs):
    if created:
        thread = ChatThread.objects.create(user=instance)
        Message.objects.create(
            thread=thread,
            sender=instance,
            content="Welcome to TradeRiser Support! How may we assist you today?",
            is_system=True
        )


@receiver(post_save, sender=Message)
def notify_admins_on_user_message(sender, instance, created, **kwargs):
    if not created:
        return  # Only on new messages

    # Only notify if message is from a regular user (not admin, not system)
    if instance.is_system or instance.sender.is_staff:
        return

    thread = instance.thread
    user = thread.user

    # Get all staff emails
    admin_emails = list(
        User.objects.filter(is_staff=True)
        .exclude(email='')
        .values_list('email', flat=True)
    )

    if not admin_emails:
        logger.warning("No admin emails found to notify.")
        return

    subject = f"New Support Message from {user.username}"

    html_message = f"""
    <h2>New Message in Support Chat</h2>
    <p><strong>User:</strong> {user.username} ({user.email})</p>
    <p><strong>Account ID:</strong> {user.id}</p>
    <p><strong>Message:</strong></p>
    <blockquote style="background:#f9f9f9; padding:12px; border-left:4px solid #007bff;">
        {instance.content}
    </blockquote>
    <hr>
    <p><a href="{settings.FRONTEND_URL}/admin/customercare/chathread/{thread.id}/change/" 
       style="background:#007bff; color:white; padding:10px 15px; text-decoration:none; border-radius:5px;">
       View in Admin Panel
    </a></p>
    <small>Sent at: {instance.sent_at.strftime('%Y-%m-%d %H:%M:%S UTC')}</small>
    """

    plain_message = strip_tags(html_message)

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            html_message=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admin_emails,
            fail_silently=False,
        )
        logger.info(f"Support notification sent to {len(admin_emails)} admins for user {user.id}")
    except Exception as e:
        logger.error(f"Failed to send support email: {str(e)}")