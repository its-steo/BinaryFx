# customercare/consumers.py
import json
import logging
import time
from typing import Dict, Any

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from channels.exceptions import StopConsumer
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from datetime import timedelta

# OpenAI for AI Bot
try:
    import openai
    openai.api_key = settings.OPENAI_API_KEY
except Exception as e:
    logger = logging.getLogger(__name__)
    logger.warning(f"[AI Bot] OpenAI not available: {e}")

User = get_user_model()
logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Real-time customer support chat consumer (Channels 4.3.0+)
    - JWT auth via ?token= query param (middleware)
    - Per-user private rooms
    - Rate limiting (1 msg/sec)
    - Typing indicators (bidirectional)
    - AI Bot: Auto-reply on first message or after 5min admin silence
    - Safe disconnect handling
    - Block checks on connect
    - Custom close codes: 4001 (auth), 4003 (blocked)
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.room_group_name = None
        self.user = None
        self.thread = None
        self.last_message_time = 0
        self.min_message_interval = 1.0  # 1 second

    async def connect(self):
        self.user = self.scope["user"]
        logger.info(f"[Chat] Connect attempt by user {self.user.id if self.user.is_authenticated else 'anonymous'}")

        if not self.user.is_authenticated:
            logger.warning(f"[Chat] Unauthenticated connect from {self.scope['client'][0]}")
            await self.close(code=4001)
            raise StopConsumer()

        self.thread = await self.get_thread()
        if self.thread.is_blocked():
            logger.info(f"[Chat] Blocked user {self.user.id} tried to connect")
            await self.close(code=4003)
            raise StopConsumer()

        self.room_group_name = f"chat_{self.user.id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        logger.info(f"[Chat] User {self.user.id} connected to room {self.room_group_name}")

        # Send chat history
        messages = await self.get_messages()
        await self.send(text_data=json.dumps({
            'type': 'chat_history',
            'messages': messages
        }))

        # Mark admin messages as read
        await self.mark_admin_messages_read()

    async def disconnect(self, close_code: int):
        """Safe disconnect - only if group was created"""
        if hasattr(self, 'room_group_name') and self.room_group_name:
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            msg_type = data.get('type', 'message')
        except json.JSONDecodeError:
            return

        # === TYPING INDICATOR ===
        if msg_type == 'typing':
            is_typing = data.get('is_typing', False)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'typing',
                    'is_typing': is_typing
                }
            )
            return

        # === USER MESSAGE ===
        if msg_type != 'message':
            return

        content = data.get('content', '').strip()
        if not content:
            return

        # Rate limiting
        now = time.time()
        if now - self.last_message_time < self.min_message_interval:
            logger.warning(f"[Rate Limit] User {self.user.id} blocked by rate limit")
            return
        self.last_message_time = now

        # Block check
        if self.thread.is_blocked():
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'You are blocked from sending messages.'
            }))
            return

        # Create user message
        user_message = await self.create_message(content)
        serialized_user = await self.serialize_message(user_message)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': serialized_user
            }
        )

        # === AI BOT: Auto-reply if no recent admin response ===
        recent_admin = await self.get_recent_admin_message()
        if not recent_admin:
            bot_reply = await self.generate_ai_response(content)
            if bot_reply:
                bot_message = await self.create_bot_message(bot_reply)
                serialized_bot = await self.serialize_message(bot_message)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': serialized_bot
                    }
                )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event['message']))

    async def typing(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'is_typing': event['is_typing']
        }))

    # === DATABASE METHODS ===
    @database_sync_to_async
    def get_thread(self):
        from .models import ChatThread
        return ChatThread.objects.get_or_create(user=self.user)[0]

    @database_sync_to_async
    def get_messages(self):
        from .models import ChatThread, Message
        try:
            thread = ChatThread.objects.get(user=self.user)
            msgs = thread.messages.select_related('sender').order_by('sent_at')[:100]
            return [
                {
                    'id': m.id,
                    'content': m.content,
                    'sent_at': m.sent_at.isoformat(),
                    'is_me': m.sender == self.user,
                    'sender': {
                        'username': m.sender.username,
                        'is_staff': m.sender.is_staff
                    },
                    'is_system': m.is_system,
                    'is_read': m.is_read
                }
                for m in msgs
            ]
        except Exception as e:
            logger.error(f"[Chat] Error getting messages for user {self.user.id}: {e}")
            return []

    @database_sync_to_async
    def create_message(self, content: str):
        from .models import ChatThread, Message
        try:
            thread = ChatThread.objects.get(user=self.user)
            return Message.objects.create(
                thread=thread,
                sender=self.user,
                content=content
            )
        except Exception as e:
            logger.error(f"[Chat] Error creating message for user {self.user.id}: {e}")
            raise

    @database_sync_to_async
    def serialize_message(self, message):
        return {
            'type': 'new_message',
            'id': message.id,
            'content': message.content,
            'sent_at': message.sent_at.isoformat(),
            'is_me': message.sender == self.user,
            'sender': {
                'username': message.sender.username,
                'is_staff': message.sender.is_staff
            },
            'is_system': message.is_system,
            'is_read': message.is_read
        }

    @database_sync_to_async
    def mark_admin_messages_read(self):
        from .models import ChatThread
        try:
            thread = ChatThread.objects.get(user=self.user)
            updated = thread.messages.filter(
                sender__is_staff=True,
                is_read=False
            ).update(is_read=True)
            logger.debug(f"[Chat] Marked {updated} admin messages as read for user {self.user.id}")
        except Exception as e:
            logger.error(f"[Chat] Error marking messages read for user {self.user.id}: {e}")

    @database_sync_to_async
    def get_recent_admin_message(self):
        from .models import Message
        return Message.objects.filter(
            thread=self.thread,
            sender__is_staff=True,
            sent_at__gte=timezone.now() - timedelta(minutes=5)
        ).first()

    async def generate_ai_response(self, user_content: str) -> str:
        """Generate AI bot reply using OpenAI"""
        if not settings.OPENAI_API_KEY:
            return "Thank you for your message. An agent will assist you shortly."

        try:
            response = openai.ChatCompletion.create(
                model=settings.OPENAI_MODEL or "gpt-3.5-turbo",
                messages=[
                    {
                        'role': 'system',
                        'content': 'You are a helpful, professional customer support bot for TradeRiser trading platform. '
                                   'Keep responses short (1-2 sentences), friendly, and actionable. '
                                   'End with: "An agent will assist you shortly."'
                    },
                    {'role': 'user', 'content': user_content}
                ],
                max_tokens=120,
                temperature=0.7,
                timeout=10
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"[AI Bot] Failed to generate response: {e}")
            return "Thank you for your message. An agent will assist you shortly."

    @database_sync_to_async
    def create_bot_message(self, content: str):
        from .models import Message
        # Use a system user or create a dedicated bot user
        bot_user = User.objects.filter(is_staff=True).first()  # Fallback to first admin
        if not bot_user:
            bot_user = self.user  # Fallback
        return Message.objects.create(
            thread=self.thread,
            sender=bot_user,
            content=content,
            is_system=True
        )


# === ADMIN CONSUMER ===
class AdminChatConsumer(AsyncWebsocketConsumer):
    """
    Admin dashboard WebSocket: Join multiple user rooms, send/receive messages
    - Auth: Staff only
    - Actions: join_room, leave_room, send_message
    - Real-time updates from users
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.admin = None
        self.joined_rooms = set()

    async def connect(self):
        self.admin = self.scope["user"]
        if not self.admin.is_authenticated or not self.admin.is_staff:
            logger.warning(f"[AdminChat] Unauthorized connect attempt")
            await self.close(code=4001)
            raise StopConsumer()

        await self.accept()
        logger.info(f"[AdminChat] Admin {self.admin.id} connected")
        await self.send(text_data=json.dumps({
            'type': 'connected',
            'message': 'Admin connected to support dashboard'
        }))

    async def disconnect(self, close_code: int):
        for room in list(self.joined_rooms):
            await self.channel_layer.group_discard(room, self.channel_name)
        self.joined_rooms.clear()
        logger.info(f"[AdminChat] Admin {self.admin.id} disconnected")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get('action')
        except json.JSONDecodeError:
            return

        if action == 'join_room':
            user_id = data.get('user_id')
            if not user_id:
                return
            room = f"chat_{user_id}"
            await self.channel_layer.group_add(room, self.channel_name)
            self.joined_rooms.add(room)
            logger.info(f"[AdminChat] Admin joined room {room}")
            await self.send(text_data=json.dumps({
                'type': 'joined',
                'room': room
            }))

        elif action == 'leave_room':
            user_id = data.get('user_id')
            if not user_id:
                return
            room = f"chat_{user_id}"
            await self.channel_layer.group_discard(room, self.channel_name)
            self.joined_rooms.discard(room)

        elif action == 'send_message':
            user_id = data.get('user_id')
            content = data.get('content', '').strip()
            if not user_id or not content:
                return
            room = f"chat_{user_id}"
            if room not in self.joined_rooms:
                return
            message = await self.create_admin_message(user_id, content)
            serialized = await self.serialize_admin_message(message)
            await self.channel_layer.group_send(room, {
                'type': 'chat_message',
                'message': serialized
            })

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event['message']))

    async def typing(self, event):
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'is_typing': event['is_typing']
        }))

    @database_sync_to_async
    def create_admin_message(self, user_id, content):
        from .models import ChatThread, Message
        thread = ChatThread.objects.get(user_id=user_id)
        return Message.objects.create(
            thread=thread,
            sender=self.admin,
            content=content
        )

    @database_sync_to_async
    def serialize_admin_message(self, message):
        return {
            'type': 'new_message',
            'id': message.id,
            'content': message.content,
            'sent_at': message.sent_at.isoformat(),
            'is_me': True,
            'sender': {
                'username': message.sender.username,
                'is_staff': True
            },
            'is_system': False,
            'is_read': False
        }