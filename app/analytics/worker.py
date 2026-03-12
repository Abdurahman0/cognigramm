import asyncio
import logging
from datetime import datetime, timezone
from uuid import uuid4

from aio_pika import IncomingMessage
from sqlalchemy.dialects.postgresql import insert

from app.analytics.models import (
    AnalyticsDailyConversationActivity,
    AnalyticsDailyMetric,
    AnalyticsDailyUserActivity,
    AnalyticsEventRecord,
    AnalyticsEventTypeDB,
)
from app.analytics.schemas import AnalyticsEvent, AnalyticsEventType
from app.config import get_settings
from app.database.session import async_session_maker
from app.queue.rabbitmq import RabbitMQClient


logger = logging.getLogger("analytics_worker")
logging.basicConfig(level=logging.INFO)


class AnalyticsWorkerRuntime:
    def __init__(self) -> None:
        settings = get_settings()
        self.retry_limit = settings.worker_retry_limit
        self.queue_name = settings.analytics_queue_name
        self.rabbitmq = RabbitMQClient(
            settings.rabbitmq_url,
            settings.message_queue_name,
            settings.notification_queue_name,
            settings.analytics_queue_name,
        )

    async def run(self) -> None:
        await self.rabbitmq.connect()
        await self.rabbitmq.consume_analytics(self._consume_analytics)
        await asyncio.Future()

    async def _consume_analytics(self, payload: dict, message: IncomingMessage) -> None:
        try:
            event = AnalyticsEvent.model_validate(payload)
            await self._persist_event(event)
            await message.ack()
        except Exception as exc:
            logger.exception("analytics_consume_error payload=%s error=%s", payload, exc)
            retry_count = int(payload.get("retry_count", 0)) + 1
            if retry_count <= self.retry_limit:
                payload["retry_count"] = retry_count
                await self.rabbitmq.publish(
                    self.queue_name,
                    payload,
                    message_id=payload.get("event_id") or str(uuid4()),
                )
            await message.ack()

    async def _persist_event(self, event: AnalyticsEvent) -> None:
        occurred_at = event.occurred_at
        if occurred_at.tzinfo is None:
            occurred_at = occurred_at.replace(tzinfo=timezone.utc)
        metric_date = occurred_at.date()

        async with async_session_maker() as session:
            record_stmt = insert(AnalyticsEventRecord).values(
                event_id=event.event_id,
                event_type=AnalyticsEventTypeDB(event.event_type.value),
                user_id=event.user_id,
                conversation_id=event.conversation_id,
                message_id=event.message_id,
                occurred_at=occurred_at,
                event_metadata=event.metadata,
            ).on_conflict_do_nothing(index_elements=[AnalyticsEventRecord.event_id])
            result = await session.execute(record_stmt)
            if result.rowcount == 0:
                await session.rollback()
                return

            await self._increment_metric(session, metric_date, event.event_type.value, "global", 1)
            if event.conversation_id is not None and event.event_type in {
                AnalyticsEventType.message_sent,
                AnalyticsEventType.message_delivered,
                AnalyticsEventType.message_read,
            }:
                await self._increment_metric(
                    session,
                    metric_date,
                    "messages_per_conversation",
                    str(event.conversation_id),
                    1,
                )

            if event.event_type == AnalyticsEventType.message_sent:
                hour_key = occurred_at.strftime("%H")
                await self._increment_metric(session, metric_date, "message_throughput_hour", hour_key, 1)
                if event.conversation_id is not None:
                    inserted = await self._record_conversation_activity(session, metric_date, event.conversation_id, occurred_at)
                    if inserted:
                        await self._increment_metric(session, metric_date, "active_conversations", "global", 1)

            if event.event_type == AnalyticsEventType.user_online and event.user_id is not None:
                inserted = await self._record_user_activity(session, metric_date, event.user_id, occurred_at)
                if inserted:
                    await self._increment_metric(session, metric_date, "daily_active_users", "global", 1)

            await session.commit()

    async def _increment_metric(
        self,
        session,
        metric_date,
        metric_name: str,
        dimension_key: str,
        delta: int,
    ) -> None:
        stmt = insert(AnalyticsDailyMetric).values(
            metric_date=metric_date,
            metric_name=metric_name,
            dimension_key=dimension_key,
            metric_value=delta,
            updated_at=datetime.now(timezone.utc),
        ).on_conflict_do_update(
            constraint="uq_analytics_daily_metrics_dim",
            set_={
                "metric_value": AnalyticsDailyMetric.metric_value + delta,
                "updated_at": datetime.now(timezone.utc),
            },
        )
        await session.execute(stmt)

    async def _record_user_activity(self, session, metric_date, user_id: int, occurred_at: datetime) -> bool:
        stmt = insert(AnalyticsDailyUserActivity).values(
            metric_date=metric_date,
            user_id=user_id,
            first_seen_at=occurred_at,
        ).on_conflict_do_nothing(
            constraint="uq_analytics_daily_user_activity_user"
        )
        result = await session.execute(stmt)
        return result.rowcount > 0

    async def _record_conversation_activity(self, session, metric_date, conversation_id: int, occurred_at: datetime) -> bool:
        stmt = insert(AnalyticsDailyConversationActivity).values(
            metric_date=metric_date,
            conversation_id=conversation_id,
            first_activity_at=occurred_at,
        ).on_conflict_do_nothing(
            constraint="uq_analytics_daily_conversation_activity_conv"
        )
        result = await session.execute(stmt)
        return result.rowcount > 0


async def main() -> None:
    runtime = AnalyticsWorkerRuntime()
    await runtime.run()


if __name__ == "__main__":
    asyncio.run(main())
