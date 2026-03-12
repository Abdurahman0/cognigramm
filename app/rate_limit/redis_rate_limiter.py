from dataclasses import dataclass
from time import time

from redis.asyncio import Redis


@dataclass
class RateLimitResult:
    allowed: bool
    remaining: int
    reset_at_epoch: int


class RedisRateLimiter:
    def __init__(self, redis: Redis, per_second_limit: int) -> None:
        self.redis = redis
        self.per_second_limit = per_second_limit

    async def allow_message(self, user_id: int) -> RateLimitResult:
        now = int(time())
        key = f"ratelimit:messages:{user_id}:{now}"
        count = await self.redis.incr(key)
        if count == 1:
            await self.redis.expire(key, 2)
        remaining = max(0, self.per_second_limit - count)
        allowed = count <= self.per_second_limit
        return RateLimitResult(allowed=allowed, remaining=remaining, reset_at_epoch=now + 1)
