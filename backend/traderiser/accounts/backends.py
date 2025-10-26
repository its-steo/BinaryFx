# backends.py
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

UserModel = get_user_model()

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get('email')
        if username is None or password is None:
            return None
        try:
            user = UserModel.objects.get(email=username)
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
        except UserModel.DoesNotExist:
            UserModel().set_password(password)  # For timing attack prevention
            return None
        except UserModel.MultipleObjectsReturned:
            # Handle multiple users with same email by picking first active user
            user = UserModel.objects.filter(email=username, is_active=True).first()
            if user and user.check_password(password) and self.user_can_authenticate(user):
                return user
            return None

    def get_user(self, user_id):
        try:
            return UserModel.objects.get(pk=user_id)
        except UserModel.DoesNotExist:
            return None