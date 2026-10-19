"""An intentionally idle ARQ worker for B0."""

from __future__ import annotations

from urllib.parse import urlparse

from arq.connections import RedisSettings

from largent.core.config import WorkerConfig


async def worker_status(context: dict[str, object]) -> str:
    """Provide ARQ's required dormant handler without scheduling a B0 job."""
    return "idle"


def redis_settings_from_url(url: str) -> RedisSettings:
    """Translate the validated Redis URL into ARQ's connection settings."""
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or "0"),
        password=parsed.password,
        ssl=parsed.scheme == "rediss",
    )


class WorkerSettings:
    """ARQ's importable worker definition; no jobs are scheduled in B0."""

    functions: list[object] = [worker_status]
    redis_settings = redis_settings_from_url(WorkerConfig().redis_url)
