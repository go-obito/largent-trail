"""Health endpoints against real Postgres and Redis containers."""

from __future__ import annotations

from collections.abc import Iterator

import httpx
import pytest
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer
from tests.conftest import make_settings

from largent.main import create_app


@pytest.fixture(scope="module")
def dependencies() -> Iterator[tuple[str, str]]:
    """Start real service containers, or skip where a Docker daemon is unavailable."""
    try:
        postgres = PostgresContainer("postgres:16")
        redis = RedisContainer("redis:7")
        postgres.start()
        redis.start()
    except Exception as exc:
        pytest.skip(f"Docker is required for integration tests: {exc}")
    try:
        postgres_url = postgres.get_connection_url().replace(
            "postgresql+psycopg2://", "postgresql+asyncpg://"
        )
        redis_url = f"redis://{redis.get_container_host_ip()}:{redis.get_exposed_port(6379)}/0"
        yield postgres_url, redis_url
    finally:
        redis.stop()
        postgres.stop()


async def test_health_and_readiness_are_healthy(dependencies: tuple[str, str]) -> None:
    postgres_url, redis_url = dependencies
    app = create_app(make_settings(database_url=postgres_url, redis_url=redis_url))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        health = await client.get("/healthz")
        readiness = await client.get("/readyz")
    await app.state.redis.aclose()
    await app.state.engine.dispose()

    assert health.status_code == 200
    assert readiness.status_code == 200


async def test_readiness_names_a_failed_dependency(dependencies: tuple[str, str]) -> None:
    postgres_url, _ = dependencies
    app = create_app(make_settings(database_url=postgres_url, redis_url="redis://127.0.0.1:1/0"))
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/readyz")
    await app.state.redis.aclose()
    await app.state.engine.dispose()

    assert response.status_code == 503
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["code"] == "dependency_unavailable"
    assert response.json()["dependencies"] == ["redis"]
