import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import Any

import aio_pika
from aio_pika import ExchangeType, IncomingMessage, Message
from aio_pika.abc import AbstractChannel, AbstractConnection, AbstractExchange, AbstractQueue


class RabbitMQClient:
    def __init__(
        self,
        amqp_url: str,
        message_queue: str,
        notification_queue: str,
        analytics_queue: str | None = None,
    ) -> None:
        self.amqp_url = amqp_url
        self.message_queue_name = message_queue
        self.notification_queue_name = notification_queue
        self.analytics_queue_name = analytics_queue
        self.connection: AbstractConnection | None = None
        self.channel: AbstractChannel | None = None
        self.exchange: AbstractExchange | None = None
        self.message_queue: AbstractQueue | None = None
        self.notification_queue: AbstractQueue | None = None
        self.analytics_queue: AbstractQueue | None = None
        self._lock = asyncio.Lock()

    async def connect(self) -> None:
        async with self._lock:
            if self.connection is not None and not self.connection.is_closed:
                return
            self.connection = await aio_pika.connect_robust(self.amqp_url)
            self.channel = await self.connection.channel()
            await self.channel.set_qos(prefetch_count=200)
            self.exchange = await self.channel.declare_exchange(
                "messaging.exchange",
                ExchangeType.DIRECT,
                durable=True,
            )
            self.message_queue = await self.channel.declare_queue(self.message_queue_name, durable=True)
            self.notification_queue = await self.channel.declare_queue(self.notification_queue_name, durable=True)
            await self.message_queue.bind(self.exchange, routing_key=self.message_queue_name)
            await self.notification_queue.bind(self.exchange, routing_key=self.notification_queue_name)
            if self.analytics_queue_name:
                self.analytics_queue = await self.channel.declare_queue(self.analytics_queue_name, durable=True)
                await self.analytics_queue.bind(self.exchange, routing_key=self.analytics_queue_name)

    async def close(self) -> None:
        async with self._lock:
            if self.channel is not None and not self.channel.is_closed:
                await self.channel.close()
            if self.connection is not None and not self.connection.is_closed:
                await self.connection.close()

    async def publish(
        self,
        routing_key: str,
        payload: dict[str, Any],
        *,
        message_id: str | None = None,
        headers: dict[str, Any] | None = None,
    ) -> None:
        if self.exchange is None:
            await self.connect()
        if self.exchange is None:
            raise RuntimeError("RabbitMQ exchange not available")
        body = json.dumps(payload).encode("utf-8")
        message = Message(
            body=body,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            message_id=message_id,
            headers=headers or {},
        )
        await self.exchange.publish(message, routing_key=routing_key)

    async def consume_messages(
        self,
        handler: Callable[[dict[str, Any], IncomingMessage], Awaitable[None]],
    ) -> None:
        if self.message_queue is None:
            await self.connect()
        if self.message_queue is None:
            raise RuntimeError("RabbitMQ message queue not available")

        async def wrapped(message: IncomingMessage) -> None:
            payload = json.loads(message.body.decode("utf-8"))
            await handler(payload, message)

        await self.message_queue.consume(wrapped)

    async def consume_notifications(
        self,
        handler: Callable[[dict[str, Any], IncomingMessage], Awaitable[None]],
    ) -> None:
        if self.notification_queue is None:
            await self.connect()
        if self.notification_queue is None:
            raise RuntimeError("RabbitMQ notification queue not available")

        async def wrapped(message: IncomingMessage) -> None:
            payload = json.loads(message.body.decode("utf-8"))
            await handler(payload, message)

        await self.notification_queue.consume(wrapped)

    async def consume_analytics(
        self,
        handler: Callable[[dict[str, Any], IncomingMessage], Awaitable[None]],
    ) -> None:
        if self.analytics_queue_name is None:
            raise RuntimeError("Analytics queue is not configured")
        if self.analytics_queue is None:
            await self.connect()
        if self.analytics_queue is None:
            raise RuntimeError("RabbitMQ analytics queue not available")

        async def wrapped(message: IncomingMessage) -> None:
            payload = json.loads(message.body.decode("utf-8"))
            await handler(payload, message)

        await self.analytics_queue.consume(wrapped)
