"""Category use cases."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.ids import new_uuid7
from largent.core.pagination import build_page, decode_cursor
from largent.domain.errors import DomainConflict
from largent.modules.categories import repository
from largent.modules.categories.models import Category, CategoryKind
from largent.modules.categories.schemas import CategoryCreate


def _replay(existing: Category, values: dict[str, object]) -> tuple[Category, bool]:
    """Return the existing row for an identical payload; anything else is an id conflict."""
    if existing.deleted_at is None and all(getattr(existing, k) == v for k, v in values.items()):
        return existing, False
    raise DomainConflict("id_conflict")


async def create_category(
    session: AsyncSession, user_id: UUID, payload: CategoryCreate
) -> tuple[Category, bool]:
    """Create a category idempotently by its client id; the flag is True when newly created."""
    category_id = payload.id or new_uuid7()
    values = payload.model_dump(exclude={"id"})
    existing = await repository.get_category(session, user_id, category_id, include_deleted=True)
    if existing is not None:
        return _replay(existing, values)

    category = Category(id=category_id, user_id=user_id, **values)
    try:
        async with session.begin_nested():
            await repository.add_category(session, category)
    except IntegrityError:
        existing = await repository.get_category(
            session, user_id, category_id, include_deleted=True
        )
        if existing is not None:
            return _replay(existing, values)
        if await repository.name_is_taken(session, user_id, payload.kind, payload.name):
            raise DomainConflict("duplicate_name") from None
        # The id may belong to another tenant; the response must not say so.
        raise DomainConflict("id_conflict") from None
    return category, True


async def list_categories(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    cursor: str | None,
    include_archived: bool,
    kind: CategoryKind | None,
    signing_keys: Sequence[bytes],
) -> tuple[list[Category], str | None]:
    decoded = decode_cursor(cursor, signing_keys) if cursor is not None else None
    rows = await repository.list_categories(
        session,
        user_id,
        limit=limit + 1,
        cursor=decoded,
        include_archived=include_archived,
        kind=kind,
    )
    return build_page(rows, limit, signing_keys)


async def read_category(session: AsyncSession, user_id: UUID, category_id: UUID) -> Category | None:
    return await repository.get_category(session, user_id, category_id)


async def update_category(
    session: AsyncSession, user_id: UUID, category_id: UUID, changes: dict[str, object]
) -> Category | None:
    try:
        async with session.begin_nested():
            return await repository.update_category(session, user_id, category_id, changes)
    except IntegrityError:
        raise DomainConflict("duplicate_name") from None


async def delete_category(session: AsyncSession, user_id: UUID, category_id: UUID) -> None:
    """Soft delete; deleting a missing, foreign or already-deleted category is a no-op."""
    await repository.soft_delete_category(session, user_id, category_id)
