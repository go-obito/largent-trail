"""Tenant-scoped queries used by CSV import parsing."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from largent.modules.categories.models import Category, CategoryKind
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
