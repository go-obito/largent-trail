"""Transaction persistence; every query filters by `user_id` on top of RLS."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import ColumnElement, Select, case, func, select, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.pagination import PageCursor
from largent.modules.accounts.models import Account
from largent.modules.categories.models import Category
from largent.modules.transactions.models import Transaction, TransactionKind

TransactionWithNames = tuple[Transaction, str, str | None]


def _with_names() -> Select[Transaction, str, str]:
    return (
        select(
            Transaction,
            Account.name.label("account_name"),
            Category.name.label("category_name"),
        )
        .outerjoin(
            Account,
            (Account.user_id == Transaction.user_id) & (Account.id == Transaction.account_id),
        )
        .outerjoin(
            Category,
            (Category.user_id == Transaction.user_id) & (Category.id == Transaction.category_id),
        )
    )


def _named_transaction(
    transaction: Transaction, account_name: str | None, category_name: str | None
) -> TransactionWithNames:
    if account_name is None:
        raise RuntimeError("Transaction account is missing")
    return transaction, account_name, category_name


async def get_transaction_with_names(
    session: AsyncSession, user_id: UUID, transaction_id: UUID
) -> TransactionWithNames | None:
    statement = _with_names().where(
        Transaction.user_id == user_id,
        Transaction.id == transaction_id,
        Transaction.deleted_at.is_(None),
    )
    result = await session.execute(statement)
    row = result.one_or_none()
    return None if row is None else _named_transaction(row[0], row[1], row[2])


async def recent_transactions_with_names(
    session: AsyncSession, user_id: UUID, *, limit: int
) -> list[TransactionWithNames]:
    statement = (
        _with_names()
        .where(Transaction.user_id == user_id, Transaction.deleted_at.is_(None))
        .order_by(
            Transaction.occurred_on.desc(),
            Transaction.created_at.desc(),
            Transaction.id.desc(),
        )
        .limit(limit)
    )
    rows = (await session.execute(statement)).all()
    return [_named_transaction(row[0], row[1], row[2]) for row in rows]


async def get_transaction(
    session: AsyncSession, user_id: UUID, transaction_id: UUID, *, include_deleted: bool = False
) -> Transaction | None:
    statement = select(Transaction).where(
        Transaction.user_id == user_id, Transaction.id == transaction_id
    )
    if not include_deleted:
        statement = statement.where(Transaction.deleted_at.is_(None))
    return (await session.scalars(statement)).one_or_none()


async def list_transactions(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    cursor: PageCursor | None,
    date_from: date | None,
    date_to: date | None,
    account_id: UUID | None,
    category_id: UUID | None,
    kind: TransactionKind | None,
) -> list[TransactionWithNames]:
    statement = _with_names().where(
        Transaction.user_id == user_id, Transaction.deleted_at.is_(None)
    )
    if date_from is not None:
        statement = statement.where(Transaction.occurred_on >= date_from)
    if date_to is not None:
        statement = statement.where(Transaction.occurred_on <= date_to)
    if account_id is not None:
        statement = statement.where(Transaction.account_id == account_id)
    if category_id is not None:
        statement = statement.where(Transaction.category_id == category_id)
    if kind is not None:
        statement = statement.where(Transaction.kind == kind)
    if cursor is not None and cursor.occurred_on is not None:
        statement = statement.where(
            tuple_(Transaction.occurred_on, Transaction.created_at, Transaction.id)
            < tuple_(cursor.occurred_on, cursor.created_at, cursor.row_id)
        )
    statement = statement.order_by(
        Transaction.occurred_on.desc(), Transaction.created_at.desc(), Transaction.id.desc()
    ).limit(limit)
    rows = (await session.execute(statement)).all()
    return [_named_transaction(row[0], row[1], row[2]) for row in rows]


async def sum_by_account(
    session: AsyncSession, user_id: UUID, account_ids: Sequence[UUID]
) -> dict[UUID, tuple[int, int]]:
    """Return `(income_minor, expense_minor)` per account over live transactions."""
    if not account_ids:
        return {}

    def total(kind: TransactionKind) -> ColumnElement[int]:
        return func.coalesce(
            func.sum(case((Transaction.kind == kind, Transaction.amount_minor), else_=0)), 0
        )

    statement = (
        select(
            Transaction.account_id,
            total(TransactionKind.INCOME),
            total(TransactionKind.EXPENSE),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.account_id.in_(account_ids),
            Transaction.deleted_at.is_(None),
        )
        .group_by(Transaction.account_id)
    )
    rows = (await session.execute(statement)).all()
    return {row[0]: (int(row[1]), int(row[2])) for row in rows}


async def sum_expenses_by_category(
    session: AsyncSession,
    user_id: UUID,
    category_ids: Sequence[UUID],
    *,
    week_from: date,
    month_from: date,
    until: date,
) -> dict[UUID, tuple[int, int]]:
    """Return `(week_to_date_minor, month_to_date_minor)` per category in one grouped query."""
    if not category_ids:
        return {}

    def since(start: date) -> ColumnElement[int]:
        return func.coalesce(
            func.sum(case((Transaction.occurred_on >= start, Transaction.amount_minor), else_=0)),
            0,
        )

    statement = (
        select(Transaction.category_id, since(week_from), since(month_from))
        .where(
            Transaction.user_id == user_id,
            Transaction.category_id.in_(category_ids),
            Transaction.kind == TransactionKind.EXPENSE,
            Transaction.deleted_at.is_(None),
            Transaction.occurred_on >= min(week_from, month_from),
            Transaction.occurred_on <= until,
        )
        .group_by(Transaction.category_id)
    )
    rows = (await session.execute(statement)).all()
    # The IN filter excludes uncategorized rows; the check only narrows the column's type.
    return {row[0]: (int(row[1]), int(row[2])) for row in rows if row[0] is not None}


async def add_transaction(session: AsyncSession, transaction: Transaction) -> None:
    session.add(transaction)
    await session.flush()


async def update_transaction(
    session: AsyncSession, user_id: UUID, transaction_id: UUID, changes: dict[str, object]
) -> Transaction | None:
    statement = (
        update(Transaction)
        .where(
            Transaction.user_id == user_id,
            Transaction.id == transaction_id,
            Transaction.deleted_at.is_(None),
        )
        .values(**changes, updated_at=func.now())
        .returning(Transaction)
        .execution_options(populate_existing=True, synchronize_session=False)
    )
    return (await session.scalars(statement)).one_or_none()


async def soft_delete_transaction(
    session: AsyncSession, user_id: UUID, transaction_id: UUID
) -> None:
    await session.execute(
        update(Transaction)
        .where(
            Transaction.user_id == user_id,
            Transaction.id == transaction_id,
            Transaction.deleted_at.is_(None),
        )
        .values(deleted_at=func.now(), updated_at=func.now())
        .execution_options(synchronize_session=False)
    )
