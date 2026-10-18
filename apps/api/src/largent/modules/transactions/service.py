"""Transaction use cases."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.ids import new_uuid7
from largent.core.pagination import build_dated_page, decode_cursor
from largent.domain.errors import DomainConflict, DomainRuleViolation
from largent.domain.transaction_rules import check_occurred_on, local_today
from largent.modules.accounts import service as accounts_service
from largent.modules.categories import service as categories_service
from largent.modules.transactions import repository
from largent.modules.transactions.models import Transaction, TransactionKind
from largent.modules.transactions.schemas import TransactionCreate, TransactionUpdate
from largent.modules.users import service as users_service


def _replay(existing: Transaction, values: dict[str, object]) -> tuple[Transaction, bool]:
    """Return the existing row for an identical payload; anything else is an id conflict."""
    if existing.deleted_at is None and all(getattr(existing, k) == v for k, v in values.items()):
        return existing, False
    raise DomainConflict("id_conflict")


async def _require_usable_account(session: AsyncSession, user_id: UUID, account_id: UUID) -> None:
    # "Missing", "someone else's" and "deleted" are one case: the service never says which.
    account = await accounts_service.read_account(session, user_id, account_id)
    if account is None:
        raise DomainRuleViolation("invalid_reference", "account_id")
    if account.is_archived:
        raise DomainRuleViolation("archived_reference", "account_id")


async def _require_usable_category(
    session: AsyncSession, user_id: UUID, category_id: UUID, kind: TransactionKind
) -> None:
    category = await categories_service.read_category(session, user_id, category_id)
    if category is None:
        raise DomainRuleViolation("invalid_reference", "category_id")
    if category.is_archived:
        raise DomainRuleViolation("archived_reference", "category_id")
    if category.kind != kind:
        raise DomainRuleViolation("kind_mismatch", "category_id")


async def _require_valid_date(
    session: AsyncSession, user_id: UUID, occurred_on: date, now: datetime
) -> None:
    timezone = await users_service.read_timezone(session, user_id)
    check_occurred_on(occurred_on, local_today(now, timezone))


async def create_transaction(
    session: AsyncSession, user_id: UUID, payload: TransactionCreate, now: datetime
) -> tuple[Transaction, bool]:
    """Create a transaction idempotently by its client id; the flag is True when newly created."""
    transaction_id = payload.id or new_uuid7()
    values = payload.model_dump(exclude={"id"})
    existing = await repository.get_transaction(
        session, user_id, transaction_id, include_deleted=True
    )
    if existing is not None:
        return _replay(existing, values)

    await _require_usable_account(session, user_id, payload.account_id)
    if payload.category_id is not None:
        await _require_usable_category(session, user_id, payload.category_id, payload.kind)
    await _require_valid_date(session, user_id, payload.occurred_on, now)

    transaction = Transaction(id=transaction_id, user_id=user_id, **values)
    try:
        async with session.begin_nested():
            await repository.add_transaction(session, transaction)
    except IntegrityError:
        existing = await repository.get_transaction(
            session, user_id, transaction_id, include_deleted=True
        )
        if existing is not None:
            return _replay(existing, values)
        # The id may belong to another tenant; the response must not say so.
        raise DomainConflict("id_conflict") from None
    return transaction, True


async def list_transactions(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    cursor: str | None,
    date_from: date | None,
    date_to: date | None,
    account_id: UUID | None,
    category_id: UUID | None,
    kind: TransactionKind | None,
    signing_keys: Sequence[bytes],
) -> tuple[list[Transaction], str | None]:
    decoded = decode_cursor(cursor, signing_keys, dated=True) if cursor is not None else None
    rows = await repository.list_transactions(
        session,
        user_id,
        limit=limit + 1,
        cursor=decoded,
        date_from=date_from,
        date_to=date_to,
        account_id=account_id,
        category_id=category_id,
        kind=kind,
    )
    return build_dated_page(rows, limit, signing_keys)


async def read_transaction(
    session: AsyncSession, user_id: UUID, transaction_id: UUID
) -> Transaction | None:
    return await repository.get_transaction(session, user_id, transaction_id)


async def update_transaction(
    session: AsyncSession,
    user_id: UUID,
    transaction_id: UUID,
    payload: TransactionUpdate,
    now: datetime,
) -> Transaction | None:
    """Apply a partial update, re-validating whatever the change touches.

    References that are unchanged are not re-checked, so an archived account or category
    never blocks editing an existing transaction.
    """
    current = await repository.get_transaction(session, user_id, transaction_id)
    if current is None:
        return None

    kind = payload.kind or current.kind
    category_id = (
        payload.category_id if "category_id" in payload.model_fields_set else current.category_id
    )
    if payload.account_id is not None and payload.account_id != current.account_id:
        await _require_usable_account(session, user_id, payload.account_id)
    if category_id is not None:
        if category_id != current.category_id:
            await _require_usable_category(session, user_id, category_id, kind)
        elif kind != current.kind:
            # An unchanged category has the old kind (the composite FK guarantees it).
            raise DomainRuleViolation("kind_mismatch", "category_id")
    if payload.occurred_on is not None:
        await _require_valid_date(session, user_id, payload.occurred_on, now)

    changes = payload.model_dump(exclude_unset=True)
    return await repository.update_transaction(session, user_id, transaction_id, changes)


async def delete_transaction(session: AsyncSession, user_id: UUID, transaction_id: UUID) -> None:
    """Soft delete; deleting a missing, foreign or already-deleted transaction is a no-op."""
    await repository.soft_delete_transaction(session, user_id, transaction_id)
