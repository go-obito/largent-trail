"""Account use cases."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.ids import new_uuid7
from largent.core.pagination import build_page, decode_cursor
from largent.domain.errors import DomainConflict
from largent.modules.accounts import repository
from largent.modules.accounts.models import Account
from largent.modules.accounts.schemas import AccountCreate


def _replay(existing: Account, values: dict[str, object]) -> tuple[Account, bool]:
    """Return the existing row for an identical payload; anything else is an id conflict."""
    if existing.deleted_at is None and all(getattr(existing, k) == v for k, v in values.items()):
        return existing, False
    raise DomainConflict("id_conflict")


async def create_account(
    session: AsyncSession, user_id: UUID, payload: AccountCreate
) -> tuple[Account, bool]:
    """Create an account idempotently by its client id; the flag is True when newly created."""
    account_id = payload.id or new_uuid7()
    values = payload.model_dump(exclude={"id"})
    existing = await repository.get_account(session, user_id, account_id, include_deleted=True)
    if existing is not None:
        return _replay(existing, values)

    account = Account(id=account_id, user_id=user_id, **values)
    try:
        async with session.begin_nested():
            await repository.add_account(session, account)
    except IntegrityError:
        existing = await repository.get_account(session, user_id, account_id, include_deleted=True)
        if existing is not None:
            return _replay(existing, values)
        if await repository.name_is_taken(session, user_id, payload.name):
            raise DomainConflict("duplicate_name") from None
        # The id may belong to another tenant; the response must not say so.
        raise DomainConflict("id_conflict") from None
    return account, True


async def list_accounts(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    cursor: str | None,
    include_archived: bool,
    signing_keys: Sequence[bytes],
) -> tuple[list[Account], str | None]:
    decoded = decode_cursor(cursor, signing_keys) if cursor is not None else None
    rows = await repository.list_accounts(
        session, user_id, limit=limit + 1, cursor=decoded, include_archived=include_archived
    )
    return build_page(rows, limit, signing_keys)


async def read_account(session: AsyncSession, user_id: UUID, account_id: UUID) -> Account | None:
    return await repository.get_account(session, user_id, account_id)


async def pool_accounts(session: AsyncSession, user_id: UUID) -> dict[UUID, int]:
    """Opening balance per account counted in the savings pool (live and not archived)."""
    return await repository.pool_accounts(session, user_id)


async def update_account(
    session: AsyncSession, user_id: UUID, account_id: UUID, changes: dict[str, object]
) -> Account | None:
    try:
        async with session.begin_nested():
            return await repository.update_account(session, user_id, account_id, changes)
    except IntegrityError:
        raise DomainConflict("duplicate_name") from None


async def delete_account(session: AsyncSession, user_id: UUID, account_id: UUID) -> None:
    """Soft delete; deleting a missing, foreign or already-deleted account is a no-op."""
    await repository.soft_delete_account(session, user_id, account_id)
