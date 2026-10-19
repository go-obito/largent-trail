"""Need persistence; every query filters by `user_id` on top of RLS."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from largent.modules.needs.models import Need


async def get_need(
    session: AsyncSession, user_id: UUID, need_id: UUID, *, include_deleted: bool = False
) -> Need | None:
    statement = select(Need).where(Need.user_id == user_id, Need.id == need_id)
    if not include_deleted:
        statement = statement.where(Need.deleted_at.is_(None))
    return (await session.scalars(statement)).one_or_none()


async def list_needs(session: AsyncSession, user_id: UUID) -> list[Need]:
    statement = (
        select(Need)
        .where(Need.user_id == user_id, Need.deleted_at.is_(None))
        .order_by(Need.position, Need.id)
    )
    return list((await session.scalars(statement)).all())


async def lock_active_needs(session: AsyncSession, user_id: UUID) -> list[Need]:
    """Lock and return the user's active needs in list order."""
    # The advisory lock also serializes writers when the user has no rows to lock yet.
    await session.execute(
        select(func.pg_advisory_xact_lock(func.hashtextextended(str(user_id), 0)))
    )
    statement = (
        select(Need)
        .where(Need.user_id == user_id, Need.deleted_at.is_(None))
        .order_by(Need.position, Need.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return list((await session.scalars(statement)).all())


async def add_need(session: AsyncSession, need: Need) -> None:
    session.add(need)
    await session.flush()
