from datetime import datetime, timezone

from redis.asyncio import Redis

from app.config import get_settings
from app.presence.schemas import PresenceStateOut


class PresenceService:
    def __init__(self, redis: Redis) -> None:
        settings = get_settings()
        self.redis = redis
        self.session_ttl_seconds = settings.presence_session_ttl_seconds
        self.typing_ttl_seconds = settings.presence_typing_ttl_seconds
        self.instance_id = settings.websocket_instance_id

    async def user_online(
        self,
        user_id: int,
        session_id: str,
        device_id: str | None = None,
        active_conversation_id: int | None = None,
    ) -> PresenceStateOut:
        now = self._now()
        now_iso = now.isoformat()
        user_key = self._presence_key(user_id)
        sessions_key = self._sessions_key(user_id)
        session_key = self._session_key(session_id)

        pipe = self.redis.pipeline()
        pipe.hset(
            user_key,
            mapping={
                "status": "online",
                "updated_at": now_iso,
                "last_seen": now_iso,
            },
        )
        if active_conversation_id is not None:
            pipe.hset(user_key, "active_conversation_id", str(active_conversation_id))
        if device_id:
            pipe.hset(session_key, mapping={"user_id": str(user_id), "device_id": device_id, "updated_at": now_iso})
        else:
            pipe.hset(session_key, mapping={"user_id": str(user_id), "updated_at": now_iso})
        pipe.expire(session_key, self.session_ttl_seconds)
        pipe.sadd(sessions_key, session_id)
        pipe.sadd("presence:online_users", user_id)
        pipe.zadd("presence:last_seen", {str(user_id): now.timestamp()})
        pipe.sadd(self._instance_users_key(), user_id)
        await pipe.execute()
        return await self.get_user_presence(user_id)

    async def user_offline(self, user_id: int, session_id: str) -> PresenceStateOut:
        sessions_key = self._sessions_key(user_id)
        session_key = self._session_key(session_id)

        pipe = self.redis.pipeline()
        pipe.delete(session_key)
        pipe.srem(sessions_key, session_id)
        await pipe.execute()
        session_count, _ = await self._count_active_sessions(user_id)

        if session_count == 0:
            return await self._set_user_offline(user_id)
        return await self.get_user_presence(user_id)

    async def touch_session(self, user_id: int, session_id: str) -> None:
        now_iso = self._now().isoformat()
        session_key = self._session_key(session_id)
        user_key = self._presence_key(user_id)
        sessions_key = self._sessions_key(user_id)
        pipe = self.redis.pipeline()
        pipe.hset(session_key, mapping={"user_id": str(user_id), "updated_at": now_iso})
        pipe.expire(session_key, self.session_ttl_seconds)
        pipe.sadd(sessions_key, session_id)
        pipe.sadd("presence:online_users", user_id)
        pipe.hset(user_key, mapping={"status": "online", "updated_at": now_iso})
        await pipe.execute()

    async def set_active_conversation(self, user_id: int, conversation_id: int | None) -> PresenceStateOut:
        user_key = self._presence_key(user_id)
        if conversation_id is None:
            await self.redis.hset(user_key, mapping={"active_conversation_id": ""})
        else:
            await self.redis.hset(user_key, mapping={"active_conversation_id": str(conversation_id)})
        return await self.get_user_presence(user_id)

    async def typing_start(self, conversation_id: int, user_id: int) -> list[int]:
        key = self._typing_key(conversation_id)
        expire_at = int(self._now().timestamp()) + self.typing_ttl_seconds
        pipe = self.redis.pipeline()
        pipe.zadd(key, {str(user_id): expire_at})
        pipe.expire(key, self.typing_ttl_seconds + 3)
        await pipe.execute()
        return await self.get_typing_users(conversation_id)

    async def typing_stop(self, conversation_id: int, user_id: int) -> list[int]:
        key = self._typing_key(conversation_id)
        await self.redis.zrem(key, str(user_id))
        return await self.get_typing_users(conversation_id)

    async def get_typing_users(self, conversation_id: int) -> list[int]:
        key = self._typing_key(conversation_id)
        now_ts = int(self._now().timestamp())
        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(key, "-inf", now_ts - 1)
        pipe.zrangebyscore(key, now_ts, "+inf")
        result = await pipe.execute()
        values = result[1] if len(result) > 1 else []
        return [int(value) for value in values]

    async def get_user_presence(self, user_id: int) -> PresenceStateOut:
        user_key = self._presence_key(user_id)
        data = await self.redis.hgetall(user_key)
        sessions, _ = await self._count_active_sessions(user_id)
        if sessions == 0 and data.get("status") == "online":
            await self._set_user_offline(user_id)
            data = await self.redis.hgetall(user_key)
        status = data.get("status", "offline")
        active_conversation_raw = data.get("active_conversation_id")
        active_conversation_id = int(active_conversation_raw) if active_conversation_raw else None
        last_seen_raw = data.get("last_seen")
        updated_raw = data.get("updated_at")
        return PresenceStateOut(
            user_id=user_id,
            is_online=status == "online",
            active_conversation_id=active_conversation_id,
            sessions=sessions,
            last_seen=self._parse_datetime(last_seen_raw),
            updated_at=self._parse_datetime(updated_raw),
        )

    async def list_online_users(self, limit: int = 5000) -> list[int]:
        values = await self.redis.smembers("presence:online_users")
        user_ids: list[int] = []
        for value in values:
            user_id = int(value)
            sessions, _ = await self._count_active_sessions(user_id)
            if sessions > 0:
                user_ids.append(user_id)
            else:
                await self._set_user_offline(user_id)
        user_ids.sort()
        return user_ids[:limit]

    async def cleanup_stale_online_users(self) -> list[PresenceStateOut]:
        values = await self.redis.smembers("presence:online_users")
        stale_users: list[PresenceStateOut] = []
        for value in values:
            user_id = int(value)
            sessions, _ = await self._count_active_sessions(user_id)
            if sessions == 0:
                stale_users.append(await self._set_user_offline(user_id))
        return stale_users

    async def register_room_instance(self, conversation_id: int) -> None:
        key = f"conversation:{conversation_id}:ws_instances"
        await self.redis.sadd(key, self.instance_id)
        await self.redis.expire(key, self.session_ttl_seconds + 60)

    async def unregister_room_instance_if_empty(self, conversation_id: int, local_room_connections: int) -> None:
        if local_room_connections > 0:
            return
        key = f"conversation:{conversation_id}:ws_instances"
        await self.redis.srem(key, self.instance_id)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _parse_datetime(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    @staticmethod
    def _presence_key(user_id: int) -> str:
        return f"user:{user_id}:presence"

    @staticmethod
    def _sessions_key(user_id: int) -> str:
        return f"user:{user_id}:sessions"

    @staticmethod
    def _session_key(session_id: str) -> str:
        return f"session:{session_id}:presence"

    @staticmethod
    def _typing_key(conversation_id: int) -> str:
        return f"conversation:{conversation_id}:typing"

    def _instance_users_key(self) -> str:
        return f"ws:{self.instance_id}:users"

    async def _count_active_sessions(self, user_id: int) -> tuple[int, list[str]]:
        sessions_key = self._sessions_key(user_id)
        session_ids = list(await self.redis.smembers(sessions_key))
        if not session_ids:
            return 0, []
        pipe = self.redis.pipeline()
        for session_id in session_ids:
            pipe.exists(self._session_key(session_id))
        exists_results = await pipe.execute()
        stale = [session_id for session_id, exists in zip(session_ids, exists_results) if not exists]
        if stale:
            await self.redis.srem(sessions_key, *stale)
        return len(session_ids) - len(stale), stale

    async def _set_user_offline(self, user_id: int) -> PresenceStateOut:
        now = self._now()
        now_iso = now.isoformat()
        user_key = self._presence_key(user_id)
        pipe = self.redis.pipeline()
        pipe.hset(
            user_key,
            mapping={
                "status": "offline",
                "updated_at": now_iso,
                "last_seen": now_iso,
                "active_conversation_id": "",
            },
        )
        pipe.srem("presence:online_users", user_id)
        pipe.srem(self._instance_users_key(), user_id)
        pipe.zadd("presence:last_seen", {str(user_id): now.timestamp()})
        await pipe.execute()
        return PresenceStateOut(
            user_id=user_id,
            is_online=False,
            active_conversation_id=None,
            sessions=0,
            last_seen=now,
            updated_at=now,
        )
