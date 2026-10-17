"""Redis construction and readiness checking."""

from __future__ import annotations

from typing import cast

from redis.asyncio import Redis

from largent.core.config import Settings


def create_redis(settings: Settings) -> Redis:
    """Create a Redis client without opening a connection."""
    return cast(Redis, Redis.from_url(settings.redis_url, decode_responses=True))


async def check_redis(client: Redis) -> None:
    """Raise if Redis cannot respond to a ping."""
    await client.ping()
