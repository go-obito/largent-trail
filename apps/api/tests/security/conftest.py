"""Real-Postgres fixtures and reusable tenant isolation assertions."""

from __future__ import annotations

import asyncio
import os
import secrets
import subprocess
import sys
from collections.abc import AsyncIterator, Awaitable, Callable, Iterator, Sequence
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from testcontainers.postgres import PostgresContainer
from tests.conftest import make_settings

from largent.core.clock import utc_now
from largent.core.config import Settings
from largent.core.tenancy import SessionFactory, get_current_user_id, tenant_session
from largent.db.rls import enable_tenant_rls

APP_CREDENTIAL = "test-" + "app-password"
MIGRATOR_CREDENTIAL = "test-" + "migrator-password"
TenantSessionFactory = Callable[[UUID], AbstractAsyncContextManager[AsyncSession]]
ApiClientFactory = Callable[..., Awaitable[httpx.AsyncClient]]
RLS_TABLE_EXCEPTIONS = frozenset({"users"})
API_DIRECTORY = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class TenantDatabaseURLs:
    admin: str
    app: str
    migrator: str


@pytest.fixture(scope="session")
def tenant_postgres_url() -> Iterator[str]:
    """Start the disposable Postgres database used by the security suite."""
    try:
        container = PostgresContainer("postgres:16")
        container.start()
    except Exception as exc:
        pytest.skip(f"Docker is required for tenant security tests: {exc}")
    url = make_url(container.get_connection_url()).set(drivername="postgresql+asyncpg")
    try:
        yield url.render_as_string(hide_password=False)
    finally:
        container.stop()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def tenant_database(tenant_postgres_url: str) -> AsyncIterator[TenantDatabaseURLs]:
    """Create the same restricted role and schema ownership model as local Postgres."""
    admin_engine = create_async_engine(tenant_postgres_url)
    async with admin_engine.begin() as connection:
        await connection.execute(
            text(
                "CREATE ROLE largent_migrator LOGIN "
                "PASSWORD 'test-migrator-password' "
                "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS"
            )
        )
        await connection.execute(
            text(
                "CREATE ROLE largent_app LOGIN "
                "PASSWORD 'test-app-password' "
                "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS"
            )
        )
        await connection.execute(text("REVOKE CREATE ON SCHEMA public FROM PUBLIC"))
        await connection.execute(text("ALTER SCHEMA public OWNER TO largent_migrator"))
        await connection.execute(text("GRANT USAGE, CREATE ON SCHEMA public TO largent_migrator"))
        await connection.execute(text("GRANT USAGE ON SCHEMA public TO largent_app"))
        await connection.execute(
            text(
                "ALTER DEFAULT PRIVILEGES FOR ROLE largent_migrator IN SCHEMA public "
                "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO largent_app"
            )
        )
    await admin_engine.dispose()

    base_url = make_url(tenant_postgres_url)
    database_urls = TenantDatabaseURLs(
        admin=tenant_postgres_url,
        app=base_url.set(username="largent_app", password=APP_CREDENTIAL).render_as_string(
            hide_password=False
        ),
        migrator=base_url.set(
            username="largent_migrator", password=MIGRATOR_CREDENTIAL
        ).render_as_string(hide_password=False),
    )
    environment = os.environ.copy()
    environment.update(
        {
            "ENVIRONMENT": "test",
            "LOG_LEVEL": "INFO",
            "DATABASE_URL": database_urls.app,
            "MIGRATION_DATABASE_URL": database_urls.migrator,
            "REDIS_URL": "redis://127.0.0.1:6379/0",
            "CORS_ALLOWED_ORIGINS": '["http://localhost:3000"]',
            "AUTH_PROVIDER": "clerk",
            "CLERK_ISSUER": "https://clerk.test",
            "CLERK_AUDIENCE": "largent-api",
            "CLERK_AUTHORIZED_PARTIES": '["http://localhost:3000"]',
            "CURSOR_SIGNING_KEYS": secrets.token_urlsafe(48),
        }
    )
    migration = await asyncio.to_thread(
        subprocess.run,
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=API_DIRECTORY,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    if migration.returncode != 0:
        pytest.fail(f"Empty-database migration failed:\n{migration.stdout}\n{migration.stderr}")
    downgrade = await asyncio.to_thread(
        subprocess.run,
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", "downgrade", "-1"],
        cwd=API_DIRECTORY,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    if downgrade.returncode != 0:
        pytest.fail(f"One-step migration downgrade failed:\n{downgrade.stdout}\n{downgrade.stderr}")
    upgrade = await asyncio.to_thread(
        subprocess.run,
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=API_DIRECTORY,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )
    if upgrade.returncode != 0:
        pytest.fail(f"Migration re-upgrade failed:\n{upgrade.stdout}\n{upgrade.stderr}")
    yield database_urls


@pytest_asyncio.fixture
async def app_engine(tenant_database: TenantDatabaseURLs) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(tenant_database.app, pool_size=5, max_overflow=5)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def migrator_engine(tenant_database: TenantDatabaseURLs) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(tenant_database.migrator, pool_size=2)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture
def app_session_factory(app_engine: AsyncEngine) -> SessionFactory:
    return async_sessionmaker(app_engine, expire_on_commit=False)


@pytest.fixture
def as_tenant(app_session_factory: SessionFactory) -> TenantSessionFactory:
    def create_session(user_id: UUID) -> AbstractAsyncContextManager[AsyncSession]:
        return tenant_session(user_id, app_session_factory)

    return create_session


@pytest.fixture
def tenant_a() -> UUID:
    return UUID("018f0000-0000-7000-8000-00000000000a")


@pytest.fixture
def tenant_b() -> UUID:
    return UUID("018f0000-0000-7000-8000-00000000000b")


@pytest_asyncio.fixture
async def tenant_probe(migrator_engine: AsyncEngine) -> AsyncIterator[None]:
    """Create a test-only tenant table and seed its fixed test owners."""

    def create_table(connection: Connection) -> None:
        connection.execute(
            text(
                "CREATE TABLE tenant_probe ("
                "id uuid PRIMARY KEY, user_id uuid NOT NULL "
                "REFERENCES users(id) ON DELETE CASCADE, "
                "value text NOT NULL)"
            )
        )
        operations = Operations(MigrationContext.configure(connection))
        enable_tenant_rls(operations, "tenant_probe")
        connection.execute(
            text(
                "INSERT INTO users (id, auth_provider, auth_subject) VALUES "
                "('018f0000-0000-7000-8000-00000000000a', 'test', 'tenant-a'), "
                "('018f0000-0000-7000-8000-00000000000b', 'test', 'tenant-b') "
                "ON CONFLICT (auth_provider, auth_subject) DO NOTHING"
            )
        )

    async with migrator_engine.begin() as connection:
        await connection.run_sync(create_table)
    try:
        yield
    finally:
        async with migrator_engine.begin() as connection:
            await connection.execute(text("DROP TABLE IF EXISTS tenant_probe"))


_TENANT_TABLE_NAMES = (
    "SELECT c.relname FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace "
    "WHERE n.nspname = 'public' AND c.relkind = 'r' AND EXISTS ("
    "SELECT 1 FROM pg_attribute AS a WHERE a.attrelid = c.oid AND a.attname = 'user_id' "
    "AND a.attnum > 0 AND NOT a.attisdropped)"
)


@pytest_asyncio.fixture
async def seeded_tenants(tenant_database: TenantDatabaseURLs) -> AsyncIterator[None]:
    """Give each test users A and B and empty tenant tables (superuser bypasses RLS)."""
    engine = create_async_engine(tenant_database.admin)
    try:
        async with engine.begin() as connection:
            names: list[str] = list((await connection.execute(text(_TENANT_TABLE_NAMES))).scalars())
            if names:
                tables = ", ".join(f'"{name}"' for name in names)
                await connection.execute(text(f"TRUNCATE {tables} CASCADE"))
            await connection.execute(
                text(
                    "INSERT INTO users (id, auth_provider, auth_subject) VALUES "
                    "('018f0000-0000-7000-8000-00000000000a', 'test', 'tenant-a'), "
                    "('018f0000-0000-7000-8000-00000000000b', 'test', 'tenant-b') "
                    "ON CONFLICT (auth_provider, auth_subject) DO NOTHING"
                )
            )
            # Most tests need an empty category list; seeding tests use `unseeded_tenants`.
            await connection.execute(
                text(
                    "UPDATE users SET defaults_seeded_at = now(), timezone = 'Africa/Accra' "
                    "WHERE auth_provider = 'test'"
                )
            )
    finally:
        await engine.dispose()
    yield


@pytest_asyncio.fixture
async def unseeded_tenants(
    tenant_database: TenantDatabaseURLs, seeded_tenants: None
) -> AsyncIterator[None]:
    """Like `seeded_tenants`, but users A and B have not had default categories seeded yet."""
    engine = create_async_engine(tenant_database.admin)
    try:
        async with engine.begin() as connection:
            await connection.execute(
                text("UPDATE users SET defaults_seeded_at = NULL WHERE auth_provider = 'test'")
            )
    finally:
        await engine.dispose()
    yield


@pytest_asyncio.fixture
async def api_client(
    app_session_factory: SessionFactory, seeded_tenants: None
) -> AsyncIterator[ApiClientFactory]:
    """Open HTTP clients that act as a given user against the real app and real Postgres."""
    from largent.main import create_app

    opened: list[tuple[httpx.AsyncClient, FastAPI]] = []

    async def open_client(
        user_id: UUID, settings: Settings | None = None, now: datetime | None = None
    ) -> httpx.AsyncClient:
        app = create_app(settings or make_settings())
        app.state.session_factory = app_session_factory
        app.dependency_overrides[get_current_user_id] = lambda: user_id
        if now is not None:
            app.dependency_overrides[utc_now] = lambda: now
        await app.state.auth_provider.aclose()
        client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        opened.append((client, app))
        return client

    yield open_client
    for client, app in opened:
        await client.aclose()
        await app.state.engine.dispose()
        await app.state.redis.aclose()


async def tenant_tables_without_rls(engine: AsyncEngine) -> list[str]:
    async with engine.connect() as connection:
        result = await connection.execute(
            text(
                "SELECT c.relname "
                "FROM pg_class AS c "
                "JOIN pg_namespace AS n ON n.oid = c.relnamespace "
                "WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') "
                "AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r', 'p') "
                "AND ((EXISTS ("
                "  SELECT 1 FROM pg_attribute AS a "
                "  WHERE a.attrelid = c.oid AND a.attname = 'user_id' "
                "  AND a.attnum > 0 AND NOT a.attisdropped"
                ") AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR NOT EXISTS ("
                "  SELECT 1 FROM pg_policy AS p "
                "  WHERE p.polrelid = c.oid AND p.polname = 'tenant_isolation'"
                "))) OR (c.relname = 'users' AND (NOT c.relrowsecurity "
                "OR NOT c.relforcerowsecurity OR NOT EXISTS ("
                "SELECT 1 FROM pg_policy AS p WHERE p.polrelid = c.oid "
                "AND p.polname = 'user_self') OR NOT EXISTS ("
                "SELECT 1 FROM pg_policy AS p WHERE p.polrelid = c.oid "
                "AND p.polname = 'user_self_update')))) ORDER BY c.relname"
            )
        )
        return list(result.scalars().all())


async def assert_tenant_tables_have_rls(engine: AsyncEngine) -> None:
    violations = await tenant_tables_without_rls(engine)
    assert not violations, (
        f"Tenant tables without forced tenant_isolation RLS or users self RLS: {violations}"
    )


async def assert_tenant_isolated[T](
    as_tenant: TenantSessionFactory,
    load_values: Callable[[AsyncSession], Awaitable[Sequence[T]]],
    tenant_a: UUID,
    tenant_b: UUID,
    expected_a: Sequence[T],
    expected_b: Sequence[T],
) -> None:
    """Assert a caller's repository query sees only its own tenant's expected values."""
    async with as_tenant(tenant_a) as session:
        values_a = await load_values(session)
    async with as_tenant(tenant_b) as session:
        values_b = await load_values(session)
    assert list(values_a) == list(expected_a)
    assert list(values_b) == list(expected_b)
