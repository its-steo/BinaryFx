# admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django import forms
from .models import User, Account
from dashboard.models import Transaction
from django.apps import apps

class AccountForm(forms.ModelForm):
    balance = forms.DecimalField(max_digits=12, decimal_places=2, required=False)

    class Meta:
        model = Account
        fields = ['account_type', 'balance']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields['balance'].initial = self.instance.balance

    def save(self, commit=True):
        instance = super().save(commit=False)
        if 'balance' in self.changed_data:
            instance.balance = self.cleaned_data['balance']
        if commit:
            instance.save()
        return instance

class AccountInline(admin.TabularInline):
    model = Account
    extra = 0
    form = AccountForm
    fields = ('account_type', 'balance')

    def save_model(self, request, obj, form, change):
        if change and 'balance' in form.changed_data:
            old_balance = obj.balance
            new_balance = form.cleaned_data['balance']
            diff = new_balance - old_balance
            if diff != 0:
                obj.balance = new_balance
                Transaction.objects.create(
                    account=obj,
                    amount=diff,
                    transaction_type='deposit' if diff > 0 else 'withdrawal',
                    description=f"Admin balance update: Account {obj.id}"
                )
        super().save_model(request, obj, form, change)

class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ('username', 'email', 'phone', 'is_sashi', 'is_email_verified', 'is_active', 'is_staff')
    list_filter = ('is_sashi', 'is_email_verified', 'is_active', 'is_staff')
    search_fields = ('username', 'email', 'phone')
    ordering = ('username',)
    inlines = [AccountInline]
    
    fieldsets = (
        (None, {'fields': ('username', 'email', 'password')}),
        ('Personal Info', {'fields': ('phone',)}),
        ('Sashi & Verification', {'fields': ('is_sashi', 'is_email_verified')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'phone', 'password1', 'password2', 'is_sashi'),
        }),
    )

admin.site.register(User, CustomUserAdmin)
admin.site.register(Account)