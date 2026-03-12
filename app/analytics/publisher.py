from asyncio import Lock

from app.analytics.schemas import AnalyticsEvent
from app.config import get_settings
from app.queue.rabbitmq import RabbitMQClient


class AnalyticsPublisher:
    def __init__(self) -> None:
        settings = get_settings()
        self.queue_name = settings.analytics_queue_name
        self.rabbitmq = RabbitMQClient(
            settings.rabbitmq_url,
            settings.message_queue_name,
            settings.notification_queue_name,
            settings.analytics_queue_name,
        )
        self._connected = False
        self._lock = Lock()

    async def publish(self, event: AnalyticsEvent) -> None:
        if not self._connected:
            async with self._lock:
                if not self._connected:
                    await self.rabbitmq.connect()
                    self._connected = True
        await self.rabbitmq.publish(
            self.queue_name,
            event.model_dump(mode="json"),
            message_id=event.event_id,
        )

    async def close(self) -> None:
        if self._connected:
            await self.rabbitmq.close()
            self._connected = False
