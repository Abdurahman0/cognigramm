import asyncio
import json
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi.encoders import jsonable_encoder
from redis.asyncio import Redis
from redis.asyncio.client import PubSub


class RedisPubSub:
    def __init__(self, redis_url: str) -> None:
        self.redis = Redis.from_url(redis_url, decode_responses=True)
        self.pubsub: PubSub | None = None
        self.listener_task: asyncio.Task[Any] | None = None
        self.handler: Callable[[str, dict[str, Any]], Awaitable[None]] | None = None
        self.running = False

    async def start(self, handler: Callable[[str, dict[str, Any]], Awaitable[None]]) -> None:
        self.handler = handler
        self.pubsub = self.redis.pubsub()
        await self.pubsub.psubscribe("conversation:*", "presence", "user:*")
        self.running = True
        self.listener_task = asyncio.create_task(self._listen())

    async def stop(self) -> None:
        self.running = False
        if self.listener_task is not None:
            self.listener_task.cancel()
            try:
                await self.listener_task
            except asyncio.CancelledError:
                pass
        if self.pubsub is not None:
            await self.pubsub.aclose()
        await self.redis.aclose()

    async def publish_conversation_event(self, conversation_id: int, event: str, payload: dict[str, Any]) -> None:
        channel = f"conversation:{conversation_id}"
        message = {"event": event, "payload": jsonable_encoder(payload)}
        await self.redis.publish(channel, json.dumps(message))

    async def publish_presence_event(self, event: str, payload: dict[str, Any]) -> None:
        message = {"event": event, "payload": jsonable_encoder(payload)}
        await self.redis.publish("presence", json.dumps(message))

    async def publish_user_event(self, user_id: int, event: str, payload: dict[str, Any]) -> None:
        message = {"event": event, "payload": jsonable_encoder(payload)}
        await self.redis.publish(f"user:{user_id}", json.dumps(message))

    async def publish_ingress_event(self, payload: dict[str, Any], retries: int = 3) -> None:
        encoded = json.dumps(jsonable_encoder(payload))
        attempt = 0
        while attempt < retries:
            try:
                await self.redis.publish("ingress.events", encoded)
                return
            except Exception:
                attempt += 1
                if attempt >= retries:
                    raise
                await asyncio.sleep(0.1 * attempt)

    async def mark_user_online(self, user_id: int) -> None:
        key = f"online_connections:{user_id}"
        count = await self.redis.incr(key)
        if count == 1:
            await self.redis.sadd("presence:online_users", user_id)
            await self.publish_presence_event("user_online", {"user_id": user_id, "status": "online"})

    async def mark_user_offline(self, user_id: int) -> None:
        key = f"online_connections:{user_id}"
        count = await self.redis.decr(key)
        if count <= 0:
            await self.redis.delete(key)
            await self.redis.srem("presence:online_users", user_id)
            await self.publish_presence_event("user_offline", {"user_id": user_id, "status": "offline"})

    async def get_online_users(self) -> list[int]:
        values = await self.redis.smembers("presence:online_users")
        return [int(value) for value in values]

    async def _listen(self) -> None:
        if self.pubsub is None or self.handler is None:
            return
        while self.running:
            message = await self.pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if not message:
                await asyncio.sleep(0.05)
                continue

            channel = message.get("channel")
            data = message.get("data")
            if not isinstance(channel, str):
                continue
            if not isinstance(data, str):
                continue
            parsed = json.loads(data)
            await self.handler(channel, parsed)
