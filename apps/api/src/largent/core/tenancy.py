"""Request-scoped tenant and restricted system database sessions."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, cast
from uuid import UUID

import structlog
from fastapi import Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

SessionFactory = async_sessionmaker[AsyncSession]


def get_current_user_id() -> UUID:
    """Placeholder for B2 authentication; tests may override this dependency."""
    raise HTTPException(status_code=401, detail="Authentication is required.")


@asynccontextmanager
async def tenant_session(
    user_id: UUID, session_factory: SessionFactory
) -> AsyncIterator[AsyncSession]:
    """Yield a transaction-scoped session with the authenticated tenant selected."""
    context_tokens = structlog.contextvars.bind_contextvars(user_id=str(user_id))
    try:
        async with session_factory() as session:
            async with session.begin():
                await session.execute(
                    text("SELECT set_config('app.user_id', :user_id, true)"),
                    {"user_id": str(user_id)},
                )
                yield session
    finally:
        structlog.contextvars.reset_contextvars(**context_tokens)


@asynccontextmanager
async def system_session(session_factory: SessionFactory) -> AsyncIterator[AsyncSession]:
    """Yield a restricted-role session without tenant context for legitimate system jobs.

    Application code never receives cross-tenant access. With no tenant setting, RLS
    policies return no tenant rows; this session is only for system work such as health
    checks or migration helpers that do not need tenant data.
    """
    async with session_factory() as session:
        async with session.begin():
            yield session


async def get_tenant_session(
    request: Request,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding the current user's transaction-scoped session."""
    session_factory = cast(SessionFactory, request.app.state.session_factory)
    async with tenant_session(user_id, session_factory) as session:
        yield session
