import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import uuid4

from aio_pika import IncomingMessage
from pydantic import ValidationError
from redis.asyncio import Redis

from app.analytics.schemas import AnalyticsEvent, AnalyticsEventType
from app.config import get_settings
from app.database.session import async_session_maker
from app.events.schemas import (
    DeliveryAckIngressEvent,
    MessageIngressEvent,
    PushNotificationEvent,
    QueueEventType,
    ReadAckIngressEvent,
)
from app.messages.schemas import MessageAttachmentIn, MessageOut
from app.messages.service import MessageService
from app.notifications.service import PushNotificationService
from app.queue.rabbitmq import RabbitMQClient
from app.redis.pubsub import RedisPubSub


logger = logging.getLogger("worker")
logging.basicConfig(level=logging.INFO)


class WorkerRuntime:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.rabbitmq = RabbitMQClient(
            self.settings.rabbitmq_url,
            self.settings.message_queue_name,
            self.settings.notification_queue_name,
            self.settings.analytics_queue_name,
        )
        self.redis_pubsub = RedisPubSub(self.settings.redis_url)
        self.redis_raw = Redis.from_url(self.settings.redis_url, decode_responses=True)
        self.push_service = PushNotificationService()

    async def run(self) -> None:
        await self.rabbitmq.connect()
        await self.rabbitmq.consume_messages(self._consume_message_queue)
        await self.rabbitmq.consume_notifications(self._consume_notification_queue)
        bridge_task = asyncio.create_task(self._bridge_ingress_events())
        partition_task = asyncio.create_task(self._partition_maintenance_loop())
        try:
            await asyncio.Future()
        finally:
            bridge_task.cancel()
            partition_task.cancel()
            await self.rabbitmq.close()
            await self.redis_raw.aclose()

    async def _bridge_ingress_events(self) -> None:
        pubsub = self.redis_raw.pubsub()
        await pubsub.subscribe("ingress.events")
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if not message:
                await asyncio.sleep(0.05)
                continue
            data = message.get("data")
            if not isinstance(data, str):
                continue
            payload = json.loads(data)
            event_type = payload.get("event_type")
            if event_type not in {
                QueueEventType.create_message.value,
                QueueEventType.delivery_ack.value,
                QueueEventType.read_ack.value,
            }:
                continue
            await self.rabbitmq.publish(
                self.settings.message_queue_name,
                payload,
                message_id=payload.get("event_id"),
            )

    async def _consume_message_queue(self, payload: dict, message: IncomingMessage) -> None:
        try:
            event_type = payload.get("event_type")
            if event_type == QueueEventType.create_message.value:
                event = MessageIngressEvent.model_validate(payload)
                await self._process_message_event(event)
                await message.ack()
                return
            if event_type == QueueEventType.delivery_ack.value:
                event = DeliveryAckIngressEvent.model_validate(payload)
                await self._process_delivery_ack_event(event)
                await message.ack()
                return
            if event_type == QueueEventType.read_ack.value:
                event = ReadAckIngressEvent.model_validate(payload)
                await self._process_read_ack_event(event)
                await message.ack()
                return
            await message.ack()
        except ValidationError:
            await message.ack()
        except Exception as exc:
            logger.exception("message_queue_handler_error payload=%s error=%s", payload, exc)
            retry_count = int(payload.get("retry_count", 0)) + 1
            if retry_count <= self.settings.worker_retry_limit:
                payload["retry_count"] = retry_count
                await self.rabbitmq.publish(
                    self.settings.message_queue_name,
                    payload,
                    message_id=payload.get("event_id") or str(uuid4()),
                    headers={"x-retry-count": retry_count},
                )
                user_id = payload.get("user_id")
                if isinstance(user_id, int):
                    await self.redis_pubsub.publish_user_event(
                        user_id,
                        "message_retrying",
                        {
                            "client_message_id": payload.get("client_message_id"),
                            "retry_count": retry_count,
                        },
                    )
            else:
                user_id = payload.get("user_id")
                client_message_id = payload.get("client_message_id")
                if isinstance(user_id, int):
                    await self.redis_pubsub.publish_user_event(
                        user_id,
                        "message_failed",
                        {
                            "client_message_id": client_message_id,
                            "detail": "Message processing failed after retries",
                        },
                    )
            await message.ack()

    async def _consume_notification_queue(self, payload: dict, message: IncomingMessage) -> None:
        try:
            event = PushNotificationEvent.model_validate(payload)
            await self.push_service.send(event.user_id, event.payload)
            await message.ack()
        except Exception as exc:
            logger.exception("notification_handler_error payload=%s error=%s", payload, exc)
            retry_count = int(payload.get("retry_count", 0)) + 1
            if retry_count <= self.settings.worker_retry_limit:
                payload["retry_count"] = retry_count
                await self.rabbitmq.publish(
                    self.settings.notification_queue_name,
                    payload,
                    message_id=payload.get("event_id") or str(uuid4()),
                )
            await message.ack()

    async def _process_message_event(self, event: MessageIngressEvent) -> None:
        async with async_session_maker() as session:
            service = MessageService(session)
            attachments = [MessageAttachmentIn.model_validate(item.model_dump()) for item in event.attachments]
            queued_at = event.queued_at.replace(tzinfo=timezone.utc) if event.queued_at.tzinfo is None else event.queued_at
            message = await service.persist_ingress_message(
                user_id=event.user_id,
                conversation_id=event.conversation_id,
                content=event.content,
                message_type=event.message_type,
                client_message_id=event.client_message_id,
                attachments=attachments,
                queued_at=queued_at,
            )
            message_out = MessageOut.model_validate(message).model_dump(mode="json")
            await self.redis_pubsub.publish_conversation_event(
                conversation_id=event.conversation_id,
                event="message_persisted",
                payload=message_out,
            )
            await self.redis_pubsub.publish_conversation_event(
                conversation_id=event.conversation_id,
                event="message_delivery_state",
                payload={
                    "message_id": message.id,
                    "state": message.delivery_state.value,
                    "updated_at": message.delivery_updated_at.isoformat() if message.delivery_updated_at else None,
                },
            )
            await self.redis_pubsub.publish_user_event(
                event.user_id,
                "message_persisted_ack",
                {
                    "client_message_id": event.client_message_id,
                    "message_id": message.id,
                    "conversation_id": event.conversation_id,
                },
            )
            await self._publish_analytics(
                AnalyticsEvent(
                    event_type=AnalyticsEventType.message_sent,
                    user_id=event.user_id,
                    conversation_id=event.conversation_id,
                    message_id=message.id,
                    metadata={"message_type": event.message_type.value},
                )
            )
            participant_ids = await service.get_conversation_participant_ids(event.conversation_id)
            for participant_id in participant_ids:
                if participant_id == event.user_id:
                    continue
                is_online = await self.redis_raw.sismember("presence:online_users", participant_id)
                if is_online:
                    continue
                push_event = PushNotificationEvent(
                    user_id=participant_id,
                    payload={
                        "conversation_id": event.conversation_id,
                        "message_id": message.id,
                        "sender_id": event.user_id,
                        "message_type": event.message_type.value,
                        "preview": (event.content or "")[:120],
                    },
                )
                await self.rabbitmq.publish(
                    self.settings.notification_queue_name,
                    push_event.model_dump(mode="json"),
                    message_id=push_event.event_id,
                )

    async def _process_delivery_ack_event(self, event: DeliveryAckIngressEvent) -> None:
        async with async_session_maker() as session:
            service = MessageService(session)
            receipt, conversation_id = await service.mark_delivered(
                message_id=event.message_id,
                user_id=event.user_id,
            )
            message = await service.get_message_by_id(event.message_id)
            await self.redis_pubsub.publish_conversation_event(
                conversation_id=conversation_id,
                event="message_delivered",
                payload={
                    "message_id": receipt.message_id,
                    "user_id": receipt.user_id,
                    "delivered_at": receipt.delivered_at.isoformat() if receipt.delivered_at else None,
                    "state": receipt.state.value,
                },
            )
            if message is not None:
                await self.redis_pubsub.publish_conversation_event(
                    conversation_id=conversation_id,
                    event="message_delivery_state",
                    payload={
                        "message_id": message.id,
                        "state": message.delivery_state.value,
                        "updated_at": message.delivery_updated_at.isoformat() if message.delivery_updated_at else None,
                    },
                )
            await self._publish_analytics(
                AnalyticsEvent(
                    event_type=AnalyticsEventType.message_delivered,
                    user_id=event.user_id,
                    conversation_id=conversation_id,
                    message_id=event.message_id,
                )
            )

    async def _process_read_ack_event(self, event: ReadAckIngressEvent) -> None:
        async with async_session_maker() as session:
            service = MessageService(session)
            receipt, conversation_id = await service.mark_read(
                message_id=event.message_id,
                user_id=event.user_id,
            )
            message = await service.get_message_by_id(event.message_id)
            await self.redis_pubsub.publish_conversation_event(
                conversation_id=conversation_id,
                event="message_read",
                payload={
                    "message_id": receipt.message_id,
                    "user_id": receipt.user_id,
                    "read_at": receipt.read_at.isoformat(),
                },
            )
            if message is not None:
                await self.redis_pubsub.publish_conversation_event(
                    conversation_id=conversation_id,
                    event="message_delivery_state",
                    payload={
                        "message_id": message.id,
                        "state": message.delivery_state.value,
                        "updated_at": message.delivery_updated_at.isoformat() if message.delivery_updated_at else None,
                    },
                )
            await self._publish_analytics(
                AnalyticsEvent(
                    event_type=AnalyticsEventType.message_read,
                    user_id=event.user_id,
                    conversation_id=conversation_id,
                    message_id=event.message_id,
                )
            )

    async def _partition_maintenance_loop(self) -> None:
        while True:
            try:
                async with async_session_maker() as session:
                    service = MessageService(session)
                    await service.ensure_partitions(months_ahead=12)
            except Exception as exc:
                logger.exception("partition_maintenance_error error=%s", exc)
            await asyncio.sleep(3600)

    async def _publish_analytics(self, event: AnalyticsEvent) -> None:
        payload = event.model_dump(mode="json")
        try:
            await self.rabbitmq.publish(
                self.settings.analytics_queue_name,
                payload,
                message_id=event.event_id,
            )
        except Exception:
            return


async def main() -> None:
    runtime = WorkerRuntime()
    await runtime.run()


if __name__ == "__main__":
    asyncio.run(main())
