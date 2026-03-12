import asyncio
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.analytics.publisher import AnalyticsPublisher
from app.analytics.schemas import AnalyticsEvent, AnalyticsEventType
from app.config import Settings
from app.conversations.service import ConversationService
from app.core.security import decode_access_token
from app.events.schemas import DeliveryAckIngressEvent, MessageIngressEvent, ReadAckIngressEvent
from app.messages.models import MessageType
from app.messages.schemas import MessageAttachmentIn, MessageOut, MessageUpdateRequest
from app.messages.service import MessageService
from app.presence.service import PresenceService
from app.rate_limit.redis_rate_limiter import RedisRateLimiter
from app.redis.pubsub import RedisPubSub
from app.users.models import User
from app.websocket.manager import ConnectionManager


class SocketEnvelope(BaseModel):
    event: str
    payload: dict[str, Any] = Field(default_factory=dict)


class SendMessagePayload(BaseModel):
    conversation_id: int
    content: str | None = Field(default=None, max_length=10000)
    type: MessageType = MessageType.text
    client_message_id: str = Field(min_length=8, max_length=64)
    attachments: list[MessageAttachmentIn] = Field(default_factory=list)


class TypingPayload(BaseModel):
    conversation_id: int


class TypingLegacyPayload(BaseModel):
    conversation_id: int
    is_typing: bool = True


class ReadPayload(BaseModel):
    message_id: int


class DeliveryAckPayload(BaseModel):
    message_id: int


class EditPayload(BaseModel):
    message_id: int
    content: str = Field(min_length=1, max_length=10000)


class DeletePayload(BaseModel):
    message_id: int


class RoomPayload(BaseModel):
    conversation_id: int


class ActiveConversationPayload(BaseModel):
    conversation_id: int | None = None


class SyncPayload(BaseModel):
    conversation_id: int
    last_message_id: int = Field(ge=0)
    limit: int = Field(default=100, ge=1, le=300)


class ChatGateway:
    def __init__(
        self,
        manager: ConnectionManager,
        pubsub: RedisPubSub,
        session_maker: async_sessionmaker,
        settings: Settings,
    ) -> None:
        self.manager = manager
        self.pubsub = pubsub
        self.session_maker = session_maker
        self.rate_limiter = RedisRateLimiter(pubsub.redis, settings.message_rate_limit_per_second)
        self.presence = PresenceService(pubsub.redis)
        self.analytics = AnalyticsPublisher()
        self.presence_cleanup_interval_seconds = max(5, settings.presence_cleanup_interval_seconds)

    async def handle_connection(
        self,
        websocket: WebSocket,
        token: str,
        session_id: str | None = None,
        device_id: str | None = None,
    ) -> None:
        try:
            user_id = self._get_user_id_from_token(token)
        except HTTPException:
            await websocket.close(code=1008)
            return

        active_session_id = session_id or str(uuid4())
        async with self.session_maker() as session:
            user = await session.get(User, user_id)
            if user is None:
                await websocket.close(code=1008)
                return
            conversation_service = ConversationService(session)
            room_ids = await conversation_service.get_user_conversation_ids(user_id)

        await self.manager.connect(user_id, websocket)
        for room_id in room_ids:
            first_local = await self.manager.join_room(websocket, room_id)
            if first_local:
                await self.presence.register_room_instance(room_id)

        presence_state = await self.presence.user_online(
            user_id=user_id,
            session_id=active_session_id,
            device_id=device_id,
        )
        await self.pubsub.publish_presence_event(
            "user_online",
            {
                "user_id": user_id,
                "sessions": presence_state.sessions,
                "last_seen": presence_state.last_seen.isoformat() if presence_state.last_seen else None,
            },
        )
        await self._publish_analytics(
            AnalyticsEvent(event_type=AnalyticsEventType.user_online, user_id=user_id)
        )
        online_users = await self.presence.list_online_users()
        await websocket.send_json(
            {
                "event": "connected",
                "payload": {
                    "user_id": user_id,
                    "session_id": active_session_id,
                    "rooms": room_ids,
                    "online_users": online_users,
                    "rate_limit_per_second": self.rate_limiter.per_second_limit,
                },
            }
        )

        try:
            while True:
                raw = await websocket.receive_json()
                await self.presence.touch_session(user_id, active_session_id)
                await self.handle_client_event(user_id, websocket, raw)
        except WebSocketDisconnect:
            pass
        finally:
            removed_rooms = await self.manager.disconnect(user_id, websocket)
            for room_id in removed_rooms:
                local_count = await self.manager.local_room_size(room_id)
                await self.presence.unregister_room_instance_if_empty(room_id, local_count)
            updated_presence = await self.presence.user_offline(user_id, active_session_id)
            if not updated_presence.is_online:
                await self.pubsub.publish_presence_event(
                    "user_offline",
                    {
                        "user_id": user_id,
                        "last_seen": updated_presence.last_seen.isoformat() if updated_presence.last_seen else None,
                    },
                )

    async def handle_client_event(self, user_id: int, websocket: WebSocket, raw_data: dict[str, Any]) -> None:
        try:
            envelope = SocketEnvelope.model_validate(raw_data)
            event_name = envelope.event
            payload = envelope.payload
            if event_name == "send_message":
                await self._handle_send_message(user_id, websocket, payload)
                return
            if event_name == "delivery_ack":
                await self._handle_delivery_ack(user_id, websocket, payload)
                return
            if event_name == "read_receipt":
                await self._handle_read_ack(user_id, websocket, payload)
                return

            async with self.session_maker() as session:
                conversation_service = ConversationService(session)
                message_service = MessageService(session)

                if event_name == "typing_start":
                    typing_payload = TypingPayload.model_validate(payload)
                    await conversation_service.assert_member(typing_payload.conversation_id, user_id)
                    typing_users = await self.presence.typing_start(typing_payload.conversation_id, user_id)
                    await self.pubsub.publish_conversation_event(
                        conversation_id=typing_payload.conversation_id,
                        event="typing_start",
                        payload={
                            "conversation_id": typing_payload.conversation_id,
                            "user_id": user_id,
                            "typing_users": typing_users,
                        },
                    )
                    return

                if event_name == "typing_stop":
                    typing_payload = TypingPayload.model_validate(payload)
                    await conversation_service.assert_member(typing_payload.conversation_id, user_id)
                    typing_users = await self.presence.typing_stop(typing_payload.conversation_id, user_id)
                    await self.pubsub.publish_conversation_event(
                        conversation_id=typing_payload.conversation_id,
                        event="typing_stop",
                        payload={
                            "conversation_id": typing_payload.conversation_id,
                            "user_id": user_id,
                            "typing_users": typing_users,
                        },
                    )
                    return

                if event_name == "typing":
                    legacy_payload = TypingLegacyPayload.model_validate(payload)
                    await conversation_service.assert_member(legacy_payload.conversation_id, user_id)
                    if legacy_payload.is_typing:
                        typing_users = await self.presence.typing_start(legacy_payload.conversation_id, user_id)
                        event = "typing_start"
                    else:
                        typing_users = await self.presence.typing_stop(legacy_payload.conversation_id, user_id)
                        event = "typing_stop"
                    await self.pubsub.publish_conversation_event(
                        conversation_id=legacy_payload.conversation_id,
                        event=event,
                        payload={
                            "conversation_id": legacy_payload.conversation_id,
                            "user_id": user_id,
                            "typing_users": typing_users,
                        },
                    )
                    return

                if event_name == "edit_message":
                    edit_payload = EditPayload.model_validate(payload)
                    message = await message_service.edit_message(
                        message_id=edit_payload.message_id,
                        user_id=user_id,
                        payload=MessageUpdateRequest(content=edit_payload.content),
                    )
                    await self.pubsub.publish_conversation_event(
                        conversation_id=message.conversation_id,
                        event="message_edited",
                        payload=MessageOut.model_validate(message).model_dump(mode="json"),
                    )
                    return

                if event_name == "delete_message":
                    delete_payload = DeletePayload.model_validate(payload)
                    message = await message_service.delete_message(
                        message_id=delete_payload.message_id,
                        user_id=user_id,
                    )
                    await self.pubsub.publish_conversation_event(
                        conversation_id=message.conversation_id,
                        event="message_deleted",
                        payload=MessageOut.model_validate(message).model_dump(mode="json"),
                    )
                    return

                if event_name == "join_conversation":
                    room_payload = RoomPayload.model_validate(payload)
                    await conversation_service.assert_member(room_payload.conversation_id, user_id)
                    first_local = await self.manager.join_room(websocket, room_payload.conversation_id)
                    if first_local:
                        await self.presence.register_room_instance(room_payload.conversation_id)
                    await websocket.send_json(
                        {
                            "event": "joined_conversation",
                            "payload": {"conversation_id": room_payload.conversation_id},
                        }
                    )
                    return

                if event_name == "leave_conversation":
                    room_payload = RoomPayload.model_validate(payload)
                    became_empty = await self.manager.leave_room(websocket, room_payload.conversation_id)
                    if became_empty:
                        local_count = await self.manager.local_room_size(room_payload.conversation_id)
                        await self.presence.unregister_room_instance_if_empty(
                            room_payload.conversation_id,
                            local_count,
                        )
                    await websocket.send_json(
                        {
                            "event": "left_conversation",
                            "payload": {"conversation_id": room_payload.conversation_id},
                        }
                    )
                    return

                if event_name == "active_conversation":
                    active_payload = ActiveConversationPayload.model_validate(payload)
                    presence_state = await self.presence.set_active_conversation(user_id, active_payload.conversation_id)
                    await self.pubsub.publish_presence_event(
                        "last_seen_update",
                        {
                            "user_id": user_id,
                            "active_conversation_id": presence_state.active_conversation_id,
                            "last_seen": presence_state.last_seen.isoformat() if presence_state.last_seen else None,
                        },
                    )
                    await websocket.send_json(
                        {
                            "event": "active_conversation_set",
                            "payload": {"active_conversation_id": presence_state.active_conversation_id},
                        }
                    )
                    return

                if event_name == "sync_missed":
                    sync_payload = SyncPayload.model_validate(payload)
                    missing = await message_service.list_messages_after_id(
                        conversation_id=sync_payload.conversation_id,
                        user_id=user_id,
                        last_message_id=sync_payload.last_message_id,
                        limit=sync_payload.limit,
                    )
                    await websocket.send_json(
                        {
                            "event": "missed_messages",
                            "payload": {
                                "conversation_id": sync_payload.conversation_id,
                                "messages": [MessageOut.model_validate(item).model_dump(mode="json") for item in missing],
                            },
                        }
                    )
                    return

            await websocket.send_json(
                {
                    "event": "error",
                    "payload": {"detail": f"Unsupported event: {event_name}"},
                }
            )
        except ValidationError as exc:
            await websocket.send_json({"event": "error", "payload": {"detail": exc.errors()}})
        except HTTPException as exc:
            await websocket.send_json({"event": "error", "payload": {"detail": exc.detail}})
        except Exception:
            await websocket.send_json({"event": "error", "payload": {"detail": "Internal server error"}})

    async def handle_pubsub_message(self, channel: str, payload: dict[str, Any]) -> None:
        event = payload.get("event")
        data = payload.get("payload", {})

        if channel.startswith("conversation:"):
            conversation_id = int(channel.split(":")[1])
            await self.manager.broadcast_room(
                conversation_id,
                {"event": event, "payload": data},
            )
            return

        if channel.startswith("user:"):
            user_id = int(channel.split(":")[1])
            await self.manager.send_to_user(user_id, {"event": event, "payload": data})
            return

        if channel == "presence":
            await self.manager.broadcast_all({"event": event, "payload": data})

    async def _handle_send_message(self, user_id: int, websocket: WebSocket, payload: dict[str, Any]) -> None:
        send_payload = SendMessagePayload.model_validate(payload)
        if send_payload.type == MessageType.text and not (send_payload.content and send_payload.content.strip()):
            await websocket.send_json(
                {"event": "error", "payload": {"detail": "Text message content cannot be empty"}}
            )
            return
        if send_payload.type in {MessageType.image, MessageType.file, MessageType.voice} and not send_payload.attachments:
            await websocket.send_json(
                {"event": "error", "payload": {"detail": "Attachment is required for selected message type"}}
            )
            return

        limit_result = await self.rate_limiter.allow_message(user_id)
        if not limit_result.allowed:
            await websocket.send_json(
                {
                    "event": "rate_limited",
                    "payload": {
                        "detail": "Message rate limit exceeded",
                        "reset_at_epoch": limit_result.reset_at_epoch,
                    },
                }
            )
            return

        async with self.session_maker() as session:
            conversation_service = ConversationService(session)
            await conversation_service.assert_member(send_payload.conversation_id, user_id)

        ingress_event = MessageIngressEvent(
            user_id=user_id,
            conversation_id=send_payload.conversation_id,
            content=send_payload.content,
            message_type=send_payload.type,
            client_message_id=send_payload.client_message_id,
            attachments=send_payload.attachments,
        )
        await self.pubsub.publish_ingress_event(ingress_event.model_dump(mode="json"))
        await websocket.send_json(
            {
                "event": "message_queued",
                "payload": {
                    "client_message_id": send_payload.client_message_id,
                    "conversation_id": send_payload.conversation_id,
                },
            }
        )

    async def _handle_delivery_ack(self, user_id: int, websocket: WebSocket, payload: dict[str, Any]) -> None:
        ack_payload = DeliveryAckPayload.model_validate(payload)
        ingress = DeliveryAckIngressEvent(user_id=user_id, message_id=ack_payload.message_id)
        await self.pubsub.publish_ingress_event(ingress.model_dump(mode="json"))
        await websocket.send_json(
            {
                "event": "delivery_ack_queued",
                "payload": {"message_id": ack_payload.message_id},
            }
        )

    async def _handle_read_ack(self, user_id: int, websocket: WebSocket, payload: dict[str, Any]) -> None:
        ack_payload = ReadPayload.model_validate(payload)
        ingress = ReadAckIngressEvent(user_id=user_id, message_id=ack_payload.message_id)
        await self.pubsub.publish_ingress_event(ingress.model_dump(mode="json"))
        await websocket.send_json(
            {
                "event": "read_ack_queued",
                "payload": {"message_id": ack_payload.message_id},
            }
        )

    async def _publish_analytics(self, event: AnalyticsEvent) -> None:
        try:
            await self.analytics.publish(event)
        except Exception:
            return

    async def run_presence_maintenance(self, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            try:
                stale_states = await self.presence.cleanup_stale_online_users()
                for state in stale_states:
                    await self.pubsub.publish_presence_event(
                        "user_offline",
                        {
                            "user_id": state.user_id,
                            "last_seen": state.last_seen.isoformat() if state.last_seen else None,
                        },
                    )
            except Exception:
                pass
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=self.presence_cleanup_interval_seconds)
            except asyncio.TimeoutError:
                continue

    @staticmethod
    def _get_user_id_from_token(token: str) -> int:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if subject is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
        return int(subject)
