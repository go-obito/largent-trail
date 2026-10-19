"""Budget persistence; every query filters by `user_id` on top of RLS."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.pagination import PageCursor
from largent.modules.budgets.models import Budget, BudgetPeriod


async def get_budget(
    session: AsyncSession, user_id: UUID, budget_id: UUID, *, include_deleted: bool = False
) -> Budget | None:
    statement = select(Budget).where(Budget.user_id == user_id, Budget.id == budget_id)
    if not include_deleted:
        statement = statement.where(Budget.deleted_at.is_(None))
    return (await session.scalars(statement)).one_or_none()


async def list_budgets(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    cursor: PageCursor | None,
    include_archived: bool,
) -> list[Budget]:
    statement = select(Budget).where(Budget.user_id == user_id, Budget.deleted_at.is_(None))
    if not include_archived:
        statement = statement.where(Budget.is_archived.is_(False))
    if cursor is not None:
        statement = statement.where(
            tuple_(Budget.created_at, Budget.id) > tuple_(cursor.created_at, cursor.row_id)
        )
    statement = statement.order_by(Budget.created_at, Budget.id).limit(limit)
    return list((await session.scalars(statement)).all())


async def active_budget_exists(
    session: AsyncSession, user_id: UUID, category_id: UUID, period: BudgetPeriod
) -> bool:
    statement = select(Budget.id).where(
        Budget.user_id == user_id,
        Budget.category_id == category_id,
        Budget.period == period,
        Budget.deleted_at.is_(None),
    )
    return (await session.scalars(statement)).first() is not None


async def add_budget(session: AsyncSession, budget: Budget) -> None:
    session.add(budget)
    await session.flush()


async def update_budget(
    session: AsyncSession, user_id: UUID, budget_id: UUID, changes: dict[str, object]
) -> Budget | None:
    statement = (
        update(Budget)
        .where(Budget.user_id == user_id, Budget.id == budget_id, Budget.deleted_at.is_(None))
        .values(**changes, updated_at=func.now())
        .returning(Budget)
        .execution_options(populate_existing=True, synchronize_session=False)
    )
    return (await session.scalars(statement)).one_or_none()


async def soft_delete_budget(session: AsyncSession, user_id: UUID, budget_id: UUID) -> None:
    await session.execute(
        update(Budget)
        .where(Budget.user_id == user_id, Budget.id == budget_id, Budget.deleted_at.is_(None))
        .values(deleted_at=func.now(), updated_at=func.now())
        .execution_options(synchronize_session=False)
    )
