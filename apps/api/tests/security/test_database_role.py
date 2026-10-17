"""The runtime database role must never be privileged."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine
from testcontainers.postgres import PostgresContainer


@pytest.fixture(scope="module")
def postgres_url() -> Iterator[str]:
    try:
        container = PostgresContainer("postgres:16")
        container.start()
    except Exception as exc:
        pytest.skip(f"Docker is required for security tests: {exc}")
    try:
        yield container.get_connection_url().replace(
            "postgresql+psycopg2://", "postgresql+asyncpg://"
        )
    finally:
        container.stop()


async def test_largent_app_is_non_superuser_without_bypass_rls(postgres_url: str) -> None:
    app_password = "test-" + "password"
    admin_engine = create_async_engine(postgres_url)
    async with admin_engine.begin() as connection:
        await connection.execute(
            text("CREATE ROLE largent_app LOGIN " + "PASSWORD '" + app_password + "' NOBYPASSRLS")
        )

    app_url = make_url(postgres_url).set(username="largent_app", password=app_password)
    app_engine = create_async_engine(app_url)
    async with app_engine.connect() as connection:
        row = (
            await connection.execute(
                text("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
            )
        ).one()

    await app_engine.dispose()
    await admin_engine.dispose()
    assert row == (False, False)
