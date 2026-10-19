"""Read-only, bounded dashboard aggregation."""
# mypy: ignore-errors

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from largent.domain.daily_target import budget_status, daily_target
from largent.domain.money import account_balance
from largent.domain.needs import unallocated
from largent.domain.periods import days_in_month, month_start, week_end, week_start
from largent.domain.transaction_rules import local_today
from largent.modules.accounts.models import Account
from largent.modules.budgets.models import Budget, BudgetPeriod
from largent.modules.budgets.service import BudgetView
from largent.modules.categories.models import Category
from largent.modules.needs.models import AllocationKind, Need, NeedAllocation
from largent.modules.reports.schemas import BalanceRange
from largent.modules.transactions.models import Transaction, TransactionKind
from largent.modules.users import service as users_service


def _sum(kind: TransactionKind, condition: object = True) -> object:
    return func.coalesce(
        func.sum(
            case(
                (Transaction.kind == kind, case((condition, Transaction.amount_minor), else_=0)),
                else_=0,
            )
        ),
        0,
    )


async def dashboard(
    session: AsyncSession, user_id: UUID, now: datetime, balance_range: BalanceRange
) -> dict[str, object]:
    timezone = await users_service.read_timezone(session, user_id)
    today = local_today(now, timezone)
    start = week_start(today)
    end = week_end(today)
    month = month_start(today)

    account_rows = await session.execute(
        select(Account.id, Account.opening_balance_minor).where(
            Account.user_id == user_id, Account.deleted_at.is_(None), Account.is_archived.is_(False)
        )
    )
    accounts = {row[0]: int(row[1]) for row in account_rows.all()}
    totals = (
        await session.execute(
            select(
                Transaction.account_id,
                _sum(TransactionKind.INCOME),
                _sum(TransactionKind.EXPENSE),
            )
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.account_id.in_(accounts),
            )
            .group_by(Transaction.account_id)
        )
        if accounts
        else None
    )
    account_totals = (
        {} if totals is None else {row[0]: (int(row[1]), int(row[2])) for row in totals.all()}
    )
    balance = sum(
        account_balance(opening, *account_totals.get(account_id, (0, 0)))
        for account_id, opening in accounts.items()
    )

    range_start = start if balance_range == "this_week" else month
    net_change = None
    if balance_range != "all_time":
        change = await session.execute(
            select(
                _sum(TransactionKind.INCOME, Transaction.occurred_on >= range_start)
                - _sum(TransactionKind.EXPENSE, Transaction.occurred_on >= range_start)
            ).where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.occurred_on <= today,
            )
        )
        net_change = int(change.scalar_one())

    week_totals = await session.execute(
        select(_sum(TransactionKind.INCOME), _sum(TransactionKind.EXPENSE)).where(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_on.between(start, today),
        )
    )
    income, spent = (int(value) for value in week_totals.one())
    day_rows = await session.execute(
        select(Transaction.occurred_on, func.coalesce(func.sum(Transaction.amount_minor), 0))
        .where(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.kind == TransactionKind.EXPENSE,
            Transaction.occurred_on.between(start, today),
        )
        .group_by(Transaction.occurred_on)
    )
    by_day = {row[0]: int(row[1]) for row in day_rows.all()}
    spent_today = by_day.get(today, 0)

    budget_rows = await session.execute(
        select(Budget)
        .join(Category, (Category.user_id == Budget.user_id) & (Category.id == Budget.category_id))
        .where(
            Budget.user_id == user_id,
            Budget.deleted_at.is_(None),
            Budget.is_archived.is_(False),
            Category.deleted_at.is_(None),
        )
    )
    budgets = list(budget_rows.scalars().all())
    category_ids = [budget.category_id for budget in budgets]
    category_spend: dict[UUID, tuple[int, int]] = {}
    if category_ids:
        spending_rows = await session.execute(
            select(
                Transaction.category_id,
                func.coalesce(
                    func.sum(
                        case((Transaction.occurred_on >= start, Transaction.amount_minor), else_=0)
                    ),
                    0,
                ),
                func.coalesce(
                    func.sum(
                        case((Transaction.occurred_on >= month, Transaction.amount_minor), else_=0)
                    ),
                    0,
                ),
            )
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.kind == TransactionKind.EXPENSE,
                Transaction.category_id.in_(category_ids),
                Transaction.occurred_on.between(min(start, month), today),
            )
            .group_by(Transaction.category_id)
        )
        category_spend = {
            row[0]: (int(row[1]), int(row[2])) for row in spending_rows.all() if row[0] is not None
        }
    budget_views = []
    weekly_limits: list[int] = []
    monthly_limits: list[int] = []
    for budget in budgets:
        week_spent, month_spent = category_spend.get(budget.category_id, (0, 0))
        period_spent = week_spent if budget.period is BudgetPeriod.WEEKLY else month_spent
        budget_views.append(
            BudgetView(budget, period_spent, budget_status(period_spent, budget.limit_minor))
        )
        (weekly_limits if budget.period is BudgetPeriod.WEEKLY else monthly_limits).append(
            budget.limit_minor
        )
    daily = daily_target(
        weekly_limits, monthly_limits, spent - spent_today, spent_today, today, days_in_month(today)
    )

    recent = list(
        (
            await session.scalars(
                select(Transaction)
                .where(Transaction.user_id == user_id, Transaction.deleted_at.is_(None))
                .order_by(
                    Transaction.occurred_on.desc(),
                    Transaction.created_at.desc(),
                    Transaction.id.desc(),
                )
                .limit(5)
            )
        ).all()
    )
    needs = list(
        (
            await session.scalars(
                select(Need)
                .where(Need.user_id == user_id, Need.deleted_at.is_(None))
                .order_by(Need.position, Need.id)
            )
        ).all()
    )
    allocated_rows = await session.execute(
        select(
            NeedAllocation.need_id,
            func.coalesce(
                func.sum(
                    case(
                        (
                            NeedAllocation.kind == AllocationKind.ALLOCATE,
                            NeedAllocation.amount_minor,
                        ),
                        else_=-NeedAllocation.amount_minor,
                    )
                ),
                0,
            ),
        )
        .where(NeedAllocation.user_id == user_id)
        .group_by(NeedAllocation.need_id)
    )
    allocated = {row[0]: int(row[1]) for row in allocated_rows.all()}
    total_allocated = sum(allocated.get(need.id, 0) for need in needs)
    return {
        "today": today,
        "week_start": start,
        "week_end": end,
        "balance": balance,
        "net_change": net_change,
        "income": income,
        "spent": spent,
        "daily": daily,
        "day_spend": by_day,
        "budget_views": budget_views,
        "recent": recent,
        "needs": needs[:5],
        "total_target": sum(need.target_minor for need in needs),
        "allocated": allocated,
        "total_allocated": total_allocated,
        "unallocated": unallocated(balance, total_allocated),
    }
