import json
from typing import Any

from redis.asyncio import Redis

from app.config import get_settings


class ConversationCache:
    def __init__(self, redis: Redis) -> None:
        settings = get_settings()
        self.redis = redis
        self.ttl_seconds = settings.conversation_cache_ttl_seconds
        self.recent_limit = settings.conversation_recent_messages_limit

    async def cache_conversation_meta(
        self,
        conversation_id: int,
        payload: dict[str, Any],
        participant_ids: list[int],
    ) -> None:
        meta_key = self._meta_key(conversation_id)
        participants_key = self._participants_key(conversation_id)
        pipe = self.redis.pipeline()
        pipe.set(meta_key, json.dumps(payload), ex=self.ttl_seconds)
        if participant_ids:
            pipe.delete(participants_key)
            pipe.sadd(participants_key, *[str(user_id) for user_id in participant_ids])
            pipe.expire(participants_key, self.ttl_seconds)
        await pipe.execute()

    async def get_conversation_meta(self, conversation_id: int) -> dict[str, Any] | None:
        value = await self.redis.get(self._meta_key(conversation_id))
        if value is None:
            return None
        return json.loads(value)

    async def get_participant_ids(self, conversation_id: int) -> list[int] | None:
        key = self._participants_key(conversation_id)
        values = await self.redis.smembers(key)
        if not values:
            return None
        result = [int(value) for value in values]
        result.sort()
        return result

    async def cache_user_conversation_ids(self, user_id: int, conversation_ids: list[int]) -> None:
        key = self._user_conversations_key(user_id)
        pipe = self.redis.pipeline()
        pipe.delete(key)
        if conversation_ids:
            score = len(conversation_ids)
            mapping = {}
            for conversation_id in conversation_ids:
                mapping[str(conversation_id)] = score
                score -= 1
            pipe.zadd(key, mapping)
        pipe.expire(key, self.ttl_seconds)
        await pipe.execute()

    async def get_user_conversation_ids(self, user_id: int, limit: int = 1000) -> list[int] | None:
        values = await self.redis.zrevrange(self._user_conversations_key(user_id), 0, max(0, limit - 1))
        if not values:
            return None
        return [int(value) for value in values]

    async def add_recent_message(self, conversation_id: int, payload: dict[str, Any]) -> None:
        key = self._recent_messages_key(conversation_id)
        encoded = json.dumps(payload)
        pipe = self.redis.pipeline()
        pipe.lpush(key, encoded)
        pipe.ltrim(key, 0, self.recent_limit - 1)
        pipe.expire(key, self.ttl_seconds)
        await pipe.execute()

    async def get_recent_messages(self, conversation_id: int, limit: int) -> list[dict[str, Any]]:
        values = await self.redis.lrange(self._recent_messages_key(conversation_id), 0, max(0, limit - 1))
        if not values:
            return []
        decoded = [json.loads(value) for value in values]
        decoded.reverse()
        return decoded

    async def invalidate_conversation(self, conversation_id: int) -> None:
        pipe = self.redis.pipeline()
        pipe.delete(self._meta_key(conversation_id))
        pipe.delete(self._participants_key(conversation_id))
        pipe.delete(self._recent_messages_key(conversation_id))
        await pipe.execute()

    async def invalidate_user_conversations(self, user_id: int) -> None:
        await self.redis.delete(self._user_conversations_key(user_id))

    @staticmethod
    def _meta_key(conversation_id: int) -> str:
        return f"conversation:{conversation_id}:meta"

    @staticmethod
    def _participants_key(conversation_id: int) -> str:
        return f"conversation:{conversation_id}:participants"

    @staticmethod
    def _recent_messages_key(conversation_id: int) -> str:
        return f"conversation:{conversation_id}:recent_messages"

    @staticmethod
    def _user_conversations_key(user_id: int) -> str:
        return f"user:{user_id}:conversation_ids"
