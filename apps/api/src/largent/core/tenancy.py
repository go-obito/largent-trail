"""Request-scoped tenant and restricted system database sessions."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, cast
from uuid import UUID

import structlog
from fastapi import Depends, Header, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from largent.core.errors import ProblemHTTPException
from largent.core.security import (
    AuthProvider,
    AuthProviderUnavailable,
    InvalidToken,
    TokenExpired,
)

SessionFactory = async_sessionmaker[AsyncSession]


async def get_current_user_id(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> UUID:
    """Verify the bearer token, provision its local user, and return the tenant id."""
    request_id = getattr(request.state, "request_id", None)
    logger = structlog.get_logger(__name__)
    if authorization is None:
        logger.warning("authentication_failed", request_id=request_id, reason_code="no_token")
        raise ProblemHTTPException(
            status_code=401,
            title="Authentication required",
            detail="A bearer token is required.",
            code="unauthenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1]:
        logger.warning("authentication_failed", request_id=request_id, reason_code="malformed")
        raise ProblemHTTPException(
            status_code=401,
            title="Authentication required",
            detail="A valid bearer token is required.",
            code="unauthenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    provider = cast(AuthProvider, request.app.state.auth_provider)
    try:
        identity = await provider.verify(parts[1])
    except TokenExpired:
        logger.warning("authentication_failed", request_id=request_id, reason_code="expired")
        raise ProblemHTTPException(
            status_code=401,
            title="Token expired",
            detail="The bearer token has expired.",
            code="token_expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except InvalidToken:
        logger.warning("authentication_failed", request_id=request_id, reason_code="invalid")
        raise ProblemHTTPException(
            status_code=401,
            title="Authentication required",
            detail="A valid bearer token is required.",
            code="unauthenticated",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except AuthProviderUnavailable:
        logger.warning(
            "authentication_failed", request_id=request_id, reason_code="provider_unavailable"
        )
        raise ProblemHTTPException(
            status_code=503,
            title="Authentication unavailable",
            detail="Authentication is temporarily unavailable.",
            code="auth_provider_unavailable",
        ) from None

    from largent.modules.users.service import get_or_provision_user_id

    session_factory = cast(SessionFactory, request.app.state.session_factory)
    return await get_or_provision_user_id(identity, session_factory)


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
