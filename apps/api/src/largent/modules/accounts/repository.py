"""Account persistence; every query filters by `user_id` on top of RLS."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.pagination import PageCursor
from largent.modules.accounts.models import Account


async def get_account(
    session: AsyncSession, user_id: UUID, account_id: UUID, *, include_deleted: bool = False
) -> Account | None:
    statement = select(Account).where(Account.user_id == user_id, Account.id == account_id)
    if not include_deleted:
        statement = statement.where(Account.deleted_at.is_(None))
    return (await session.scalars(statement)).one_or_none()


async def list_accounts(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    cursor: PageCursor | None,
    include_archived: bool,
) -> list[Account]:
    statement = select(Account).where(Account.user_id == user_id, Account.deleted_at.is_(None))
    if not include_archived:
        statement = statement.where(Account.is_archived.is_(False))
    if cursor is not None:
        statement = statement.where(
            tuple_(Account.position, Account.created_at, Account.id)
            > tuple_(cursor.position, cursor.created_at, cursor.row_id)
        )
    statement = statement.order_by(Account.position, Account.created_at, Account.id).limit(limit)
    return list((await session.scalars(statement)).all())


async def name_is_taken(session: AsyncSession, user_id: UUID, name: str) -> bool:
    statement = select(Account.id).where(
        Account.user_id == user_id,
        Account.deleted_at.is_(None),
        func.lower(Account.name) == func.lower(name),
    )
    return (await session.scalars(statement)).first() is not None


async def add_account(session: AsyncSession, account: Account) -> None:
    session.add(account)
    await session.flush()


async def update_account(
    session: AsyncSession, user_id: UUID, account_id: UUID, changes: dict[str, object]
) -> Account | None:
    statement = (
        update(Account)
        .where(Account.user_id == user_id, Account.id == account_id, Account.deleted_at.is_(None))
        .values(**changes, updated_at=func.now())
        .returning(Account)
        .execution_options(populate_existing=True, synchronize_session=False)
    )
    return (await session.scalars(statement)).one_or_none()


async def soft_delete_account(session: AsyncSession, user_id: UUID, account_id: UUID) -> None:
    await session.execute(
        update(Account)
        .where(Account.user_id == user_id, Account.id == account_id, Account.deleted_at.is_(None))
        .values(deleted_at=func.now(), updated_at=func.now())
        .execution_options(synchronize_session=False)
    )
