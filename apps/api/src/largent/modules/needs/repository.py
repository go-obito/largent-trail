"""Need persistence; every query filters by `user_id` on top of RLS."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import ColumnElement, case, func, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.pagination import PageCursor
from largent.modules.needs.models import AllocationKind, Need, NeedAllocation
from largent.modules.users.models import User


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


async def lock_user(session: AsyncSession, user_id: UUID) -> None:
    """Serialize pool-affecting writers by locking the user's own row."""
    await session.execute(select(User.id).where(User.id == user_id).with_for_update())


def _signed_amount() -> ColumnElement[int]:
    return func.coalesce(
        func.sum(
            case(
                (NeedAllocation.kind == AllocationKind.ALLOCATE, NeedAllocation.amount_minor),
                else_=-NeedAllocation.amount_minor,
            )
        ),
        0,
    )


async def sum_allocated_by_need(
    session: AsyncSession, user_id: UUID, need_ids: Sequence[UUID]
) -> dict[UUID, int]:
    """Net allocated amount per need; needs without ledger rows are absent."""
    if not need_ids:
        return {}
    statement = (
        select(NeedAllocation.need_id, _signed_amount())
        .where(NeedAllocation.user_id == user_id, NeedAllocation.need_id.in_(need_ids))
        .group_by(NeedAllocation.need_id)
    )
    return {row[0]: int(row[1]) for row in (await session.execute(statement)).all()}


async def get_allocation(
    session: AsyncSession, user_id: UUID, allocation_id: UUID
) -> NeedAllocation | None:
    statement = select(NeedAllocation).where(
        NeedAllocation.user_id == user_id, NeedAllocation.id == allocation_id
    )
    return (await session.scalars(statement)).one_or_none()


async def add_allocation(session: AsyncSession, allocation: NeedAllocation) -> None:
    session.add(allocation)
    await session.flush()


async def list_allocations(
    session: AsyncSession,
    user_id: UUID,
    need_id: UUID,
    *,
    limit: int,
    cursor: PageCursor | None,
) -> list[NeedAllocation]:
    statement = select(NeedAllocation).where(
        NeedAllocation.user_id == user_id, NeedAllocation.need_id == need_id
    )
    if cursor is not None:
        statement = statement.where(
            tuple_(NeedAllocation.created_at, NeedAllocation.id)
            < tuple_(cursor.created_at, cursor.row_id)
        )
    statement = statement.order_by(
        NeedAllocation.created_at.desc(), NeedAllocation.id.desc()
    ).limit(limit)
    return list((await session.scalars(statement)).all())
