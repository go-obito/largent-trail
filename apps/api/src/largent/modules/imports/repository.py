"""Tenant-scoped queries used by CSV import parsing."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, func, insert, or_, select, text, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from largent.modules.categories.models import Category, CategoryKind
from largent.modules.imports.models import ImportBatch
from largent.modules.transactions.models import Transaction


async def existing_import_hashes(
    session: AsyncSession, user_id: UUID, hashes: set[str]
) -> set[str]:
    """Return hashes belonging to active transactions for the current tenant."""
    if not hashes:
        return set()
    result = await session.scalars(
        select(Transaction.import_hash).where(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.import_hash.in_(hashes),
        )
    )
    return {value for value in result.all() if value is not None}


async def category_usage(
    session: AsyncSession,
    user_id: UUID,
    pairs: set[tuple[str | None, CategoryKind]],
) -> Sequence[tuple[str | None, CategoryKind, UUID, int]]:
    """Count active category usage for every requested note/kind pair in one query."""
    if not pairs:
        return []

    notes = {note for note, _ in pairs if note is not None}
    null_note_kinds = {kind for note, kind in pairs if note is None}
    predicates: list[ColumnElement[bool]] = []
    if notes:
        predicates.append(Transaction.note.in_(notes))
    if null_note_kinds:
        predicates.append(and_(Transaction.note.is_(None), Transaction.kind.in_(null_note_kinds)))

    statement = (
        select(
            Transaction.note,
            Transaction.kind,
            Category.id,
            func.count(Transaction.id).label("usage_count"),
        )
        .join(
            Category,
            and_(
                Category.user_id == Transaction.user_id,
                Category.id == Transaction.category_id,
                Category.kind == Transaction.kind,
            ),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.deleted_at.is_(None),
            Transaction.kind.in_({kind for _, kind in pairs}),
            Category.deleted_at.is_(None),
            Category.is_archived.is_(False),
            or_(*predicates),
        )
        .group_by(Transaction.note, Transaction.kind, Category.id)
    )
    return (await session.execute(statement)).all()


async def categories_by_id(
    session: AsyncSession, user_id: UUID, category_ids: set[UUID]
) -> dict[UUID, Category]:
    """Load each requested tenant-owned category at most once, including archived rows."""
    if not category_ids:
        return {}
    categories = await session.scalars(
        select(Category).where(
            Category.user_id == user_id,
            Category.id.in_(category_ids),
        )
    )
    return {category.id: category for category in categories.all()}


async def lock_idempotency_key(session: AsyncSession, user_id: UUID, key: str) -> None:
    """Serialize commits using the same tenant-scoped key."""
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
        {"key": f"{user_id}:{key}"},
    )


async def get_import_batch_by_key(
    session: AsyncSession, user_id: UUID, idempotency_key: str
) -> ImportBatch | None:
    return await session.scalar(
        select(ImportBatch).where(
            ImportBatch.user_id == user_id,
            ImportBatch.idempotency_key == idempotency_key,
        )
    )


async def get_import_batch(
    session: AsyncSession, user_id: UUID, batch_id: UUID, *, lock: bool = False
) -> ImportBatch | None:
    statement = select(ImportBatch).where(
        ImportBatch.user_id == user_id,
        ImportBatch.id == batch_id,
    )
    if lock:
        statement = statement.with_for_update()
    return await session.scalar(statement)


async def add_import_batch(session: AsyncSession, batch: ImportBatch) -> None:
    session.add(batch)
    await session.flush()


async def add_transactions(
    session: AsyncSession, transactions: Sequence[dict[str, object]]
) -> None:
    if transactions:
        await session.execute(insert(Transaction), transactions)


async def list_import_batches(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    cursor_created_at: datetime | None,
    cursor_id: UUID | None,
) -> list[ImportBatch]:
    statement = select(ImportBatch).where(ImportBatch.user_id == user_id)
    if cursor_created_at is not None and cursor_id is not None:
        statement = statement.where(
            tuple_(ImportBatch.created_at, ImportBatch.id) < tuple_(cursor_created_at, cursor_id)
        )
    statement = statement.order_by(ImportBatch.created_at.desc(), ImportBatch.id.desc()).limit(
        limit
    )
    return list((await session.scalars(statement)).all())


async def undo_import_batch(
    session: AsyncSession, user_id: UUID, batch_id: UUID, now: datetime
) -> bool:
    batch = await get_import_batch(session, user_id, batch_id, lock=True)
    if batch is None:
        return False
    if batch.undone_at is None:
        await session.execute(
            update(ImportBatch)
            .where(ImportBatch.user_id == user_id, ImportBatch.id == batch_id)
            .values(undone_at=now)
        )
        await session.execute(
            update(Transaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.import_batch_id == batch_id,
                Transaction.deleted_at.is_(None),
            )
            .values(deleted_at=now, updated_at=now)
        )
    return True
