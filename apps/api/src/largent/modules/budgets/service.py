"""Budget use cases."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.ids import new_uuid7
from largent.core.pagination import build_created_page, decode_cursor
from largent.domain.daily_target import BudgetStatus, budget_status
from largent.domain.errors import DomainConflict, DomainRuleViolation
from largent.domain.periods import month_start, week_start
from largent.domain.transaction_rules import local_today
from largent.modules.budgets import repository
from largent.modules.budgets.models import Budget, BudgetPeriod
from largent.modules.budgets.schemas import BudgetCreate, BudgetUpdate
from largent.modules.categories import service as categories_service
from largent.modules.categories.models import CategoryKind
from largent.modules.transactions import service as transactions_service
from largent.modules.users import service as users_service


@dataclass(frozen=True, slots=True)
class BudgetView:
    """A budget with its spending for the current period, derived and never stored."""

    budget: Budget
    spent_minor: int
    status: BudgetStatus


def _replay(existing: Budget, values: dict[str, object]) -> tuple[Budget, bool]:
    """Return the existing row for an identical payload; anything else is an id conflict."""
    if existing.deleted_at is None and all(getattr(existing, k) == v for k, v in values.items()):
        return existing, False
    raise DomainConflict("id_conflict")


async def _require_usable_category(session: AsyncSession, user_id: UUID, category_id: UUID) -> None:
    # "Missing", "someone else's" and "deleted" are one case: the service never says which.
    category = await categories_service.read_category(session, user_id, category_id)
    if category is None:
        raise DomainRuleViolation("invalid_reference", "category_id")
    if category.kind != CategoryKind.EXPENSE:
        raise DomainRuleViolation("kind_mismatch", "category_id")
    if category.is_archived:
        raise DomainRuleViolation("archived_reference", "category_id")


async def _with_progress(
    session: AsyncSession, user_id: UUID, budgets: Sequence[Budget], now: datetime
) -> list[BudgetView]:
    """Attach week- or month-to-date spending to each budget using one grouped query."""
    if not budgets:
        return []
    today = local_today(now, await users_service.read_timezone(session, user_id))
    totals = await transactions_service.expense_totals_by_category(
        session,
        user_id,
        list({budget.category_id for budget in budgets}),
        week_from=week_start(today),
        month_from=month_start(today),
        until=today,
    )
    views: list[BudgetView] = []
    for budget in budgets:
        week_spent, month_spent = totals.get(budget.category_id, (0, 0))
        spent = week_spent if budget.period is BudgetPeriod.WEEKLY else month_spent
        views.append(BudgetView(budget, spent, budget_status(spent, budget.limit_minor)))
    return views


async def _view(session: AsyncSession, user_id: UUID, budget: Budget, now: datetime) -> BudgetView:
    return (await _with_progress(session, user_id, [budget], now))[0]


async def create_budget(
    session: AsyncSession, user_id: UUID, payload: BudgetCreate, now: datetime
) -> tuple[BudgetView, bool]:
    """Create a budget idempotently by its client id; the flag is True when newly created."""
    budget_id = payload.id or new_uuid7()
    values = payload.model_dump(exclude={"id"})
    existing = await repository.get_budget(session, user_id, budget_id, include_deleted=True)
    if existing is not None:
        budget, created = _replay(existing, values)
        return await _view(session, user_id, budget, now), created

    await _require_usable_category(session, user_id, payload.category_id)

    budget = Budget(id=budget_id, user_id=user_id, **values)
    try:
        async with session.begin_nested():
            await repository.add_budget(session, budget)
    except IntegrityError:
        existing = await repository.get_budget(session, user_id, budget_id, include_deleted=True)
        if existing is not None:
            replayed, created = _replay(existing, values)
            return await _view(session, user_id, replayed, now), created
        if await repository.active_budget_exists(
            session, user_id, payload.category_id, payload.period
        ):
            raise DomainConflict("duplicate_budget") from None
        # The id may belong to another tenant; the response must not say so.
        raise DomainConflict("id_conflict") from None
    return await _view(session, user_id, budget, now), True


async def list_budgets(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    cursor: str | None,
    include_archived: bool,
    now: datetime,
    signing_keys: Sequence[bytes],
) -> tuple[list[BudgetView], str | None]:
    decoded = decode_cursor(cursor, signing_keys) if cursor is not None else None
    rows = await repository.list_budgets(
        session, user_id, limit=limit + 1, cursor=decoded, include_archived=include_archived
    )
    page, next_cursor = build_created_page(rows, limit, signing_keys)
    return await _with_progress(session, user_id, page, now), next_cursor


async def read_budget(
    session: AsyncSession, user_id: UUID, budget_id: UUID, now: datetime
) -> BudgetView | None:
    budget = await repository.get_budget(session, user_id, budget_id)
    return None if budget is None else await _view(session, user_id, budget, now)


async def update_budget(
    session: AsyncSession, user_id: UUID, budget_id: UUID, payload: BudgetUpdate, now: datetime
) -> BudgetView | None:
    changes = payload.model_dump(exclude_unset=True)
    budget = await repository.update_budget(session, user_id, budget_id, changes)
    return None if budget is None else await _view(session, user_id, budget, now)


async def delete_budget(session: AsyncSession, user_id: UUID, budget_id: UUID) -> None:
    """Soft delete; deleting a missing, foreign or already-deleted budget is a no-op."""
    await repository.soft_delete_budget(session, user_id, budget_id)
