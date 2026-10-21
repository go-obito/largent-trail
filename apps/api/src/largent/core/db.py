"""Database engine construction and readiness checking."""

from __future__ import annotations

from sqlalchemy import MetaData, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from largent.core.config import Settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
metadata = MetaData(naming_convention=NAMING_CONVENTION)


def create_engine(settings: Settings) -> AsyncEngine:
    """Create the async application engine without opening a connection."""
    return create_async_engine(settings.database_url, pool_pre_ping=True)


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Create a non-expiring session factory for future request dependencies."""
    return async_sessionmaker(engine, expire_on_commit=False)


async def check_database(engine: AsyncEngine) -> None:
    """Raise if Postgres cannot execute a trivial statement."""
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


async def get_schema_revision(engine: AsyncEngine) -> str | None:
    """Return the database's Alembic revision, or None when it has not been initialized."""
    async with engine.connect() as connection:
        version_table_exists = await connection.scalar(
            text("SELECT to_regclass('public.alembic_version') IS NOT NULL")
        )
        if not version_table_exists:
            return None
        revision = await connection.scalar(text("SELECT version_num FROM public.alembic_version"))
        return str(revision) if revision is not None else None
