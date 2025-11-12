# management/admin.py
from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from django.core.mail import send_mail
from django.conf import settings
from django.http import HttpResponseRedirect
from .models import ManagementRequest


@admin.register(ManagementRequest)
class ManagementRequestAdmin(admin.ModelAdmin):
    list_display = (
        'management_id', 'user_link', 'stake', 'target_profit', 'payment_amount',
        'status_colored', 'days', 'current_pnl', 'action_buttons'
    )
    list_filter = ('status', 'created_at')
    search_fields = ('management_id', 'user__username', 'account_email')
    readonly_fields = ('management_id', 'payment_amount', 'current_pnl', 'created_at', 'updated_at')
    actions = ['verify_payment', 'start_management']  # LIST, NOT METHOD

    def user_link(self, obj):
        url = reverse("admin:accounts_user_change", args=[obj.user.id])
        return format_html('<a href="{}">{}</a>', url, obj.user.username)
    user_link.short_description = "User"

    def status_colored(self, obj):
        colors = {
            'pending_payment': 'orange',
            'payment_verified': 'blue',
            'credentials_pending': 'purple',
            'active': 'green',
            'completed': 'darkgreen',
            'failed': 'red',
        }
        return format_html(
            '<span style="color: {};">{}</span>',
            colors.get(obj.status, 'black'),
            obj.get_status_display()
        )
    status_colored.short_description = "Status"

    def action_buttons(self, obj):
        if obj.status == 'pending_payment' and obj.payment_transaction:
            return format_html(
                '<a href="{}" class="button">Verify</a>',
                reverse('admin:verify_management_payment', args=[obj.id])
            )
        elif obj.status == 'payment_verified':
            return format_html(
                '<a href="{}" class="button">Start</a>',
                reverse('admin:start_management', args=[obj.id])
            )
        return "-"
    action_buttons.short_description = "Actions"

    def verify_payment(self, request, queryset):
        for obj in queryset:
            if obj.payment_transaction and obj.payment_transaction.status == 'completed':
                obj.status = 'payment_verified'
                obj.save()
                send_mail(
                    "Submit Account Details",
                    f"Hi {obj.user.username},\n\nPayment verified. Submit your trading account email and password.",
                    settings.DEFAULT_FROM_EMAIL,
                    [obj.user.email],
                )
                self.message_user(request, f"Verified {obj.management_id}")
    verify_payment.short_description = "Verify Payment"

    def start_management(self, request, queryset):
        from django.utils import timezone
        for obj in queryset:
            if obj.status == 'payment_verified' and obj.days and obj.daily_stake:
                obj.status = 'active'
                obj.start_date = timezone.now().date()
                obj.end_date = obj.start_date + timezone.timedelta(days=obj.days)
                obj.save()
                send_mail(
                    "Management Started",
                    f"Hi {obj.user.username},\n\nTarget: ${obj.target_profit} in {obj.days} days.",
                    settings.DEFAULT_FROM_EMAIL,
                    [obj.user.email],
                )
    start_management.short_description = "Start Management"

    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('<int:obj_id>/verify-payment/', self.admin_site.admin_view(self.verify_payment_view), name='verify_management_payment'),
            path('<int:obj_id>/start/', self.admin_site.admin_view(self.start_management_view), name='start_management'),
        ]
        return custom_urls + urls

    def verify_payment_view(self, request, obj_id):
        obj = self.get_object(request, obj_id)
        if obj and obj.payment_transaction and obj.payment_transaction.status == 'completed':
            obj.status = 'payment_verified'
            obj.save()
            send_mail("Submit Credentials", "Payment verified.", settings.DEFAULT_FROM_EMAIL, [obj.user.email])
        return HttpResponseRedirect(reverse('admin:management_managementrequest_change', args=[obj_id]))

    def start_management_view(self, request, obj_id):
        obj = self.get_object(request, obj_id)
        if obj and obj.days and obj.daily_stake:
            from django.utils import timezone
            obj.status = 'active'
            obj.start_date = timezone.now().date()
            obj.end_date = obj.start_date + timezone.timedelta(days=obj.days)
            obj.save()
            send_mail("Management Started", f"Target: ${obj.target_profit} in {obj.days} days.", settings.DEFAULT_FROM_EMAIL, [obj.user.email])
        return HttpResponseRedirect(reverse('admin:management_managementrequest_change', args=[obj_id]))