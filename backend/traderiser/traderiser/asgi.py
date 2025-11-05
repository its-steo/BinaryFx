"""
ASGI config for traderiser project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

# traderiser/asgi.py
import os
from django.core.asgi import get_asgi_application

# 1. SET SETTINGS MODULE
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'traderiser.settings')

# 2. LOAD ASGI APP → THIS INITIALIZES DJANGO APPS
application = get_asgi_application()

# 3. NOW SAFE TO IMPORT ANYTHING
from channels.routing import ProtocolTypeRouter, URLRouter
from customercare.middleware import QueryStringJWTAuthMiddleware
import customercare.routing

# 4. FINAL ASGI ROUTER
application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": QueryStringJWTAuthMiddleware(
        URLRouter(
            customercare.routing.websocket_urlpatterns
        )
    ),
})