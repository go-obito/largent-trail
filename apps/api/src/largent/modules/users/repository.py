"""Tenant-scoped persistence operations for user profiles."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from largent.modules.users.models import User


async def get_user(session: AsyncSession, user_id: UUID) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_timezone(session: AsyncSession, user_id: UUID) -> str:
    result = await session.execute(select(User.timezone).where(User.id == user_id))
    return result.scalar_one()


async def update_user(
    session: AsyncSession,
    user_id: UUID,
    changes: dict[str, str],
) -> User | None:
    result = await session.execute(
        update(User).where(User.id == user_id).values(**changes).returning(User)
    )
    return result.scalar_one_or_none()
