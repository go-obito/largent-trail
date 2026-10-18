"""Category persistence; every query filters by `user_id` on top of RLS."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select, text, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.ids import new_uuid7
from largent.core.pagination import PageCursor
from largent.modules.categories.models import Category, CategoryKind


async def claim_default_seeding(session: AsyncSession, user_id: UUID) -> bool:
    """Atomically mark the user as seeded; only the one caller that flips the marker gets True."""
    result = await session.execute(
        text(
            "UPDATE users SET defaults_seeded_at = now() "
            "WHERE id = :id AND defaults_seeded_at IS NULL RETURNING id"
        ),
        {"id": user_id},
    )
    return result.first() is not None


async def add_default_categories(
    session: AsyncSession, user_id: UUID, defaults: Sequence[tuple[CategoryKind, str, int]]
) -> None:
    session.add_all(
        Category(id=new_uuid7(), user_id=user_id, kind=kind, name=name, position=position)
        for kind, name, position in defaults
    )
    await session.flush()


async def get_category(
    session: AsyncSession, user_id: UUID, category_id: UUID, *, include_deleted: bool = False
) -> Category | None:
    statement = select(Category).where(Category.user_id == user_id, Category.id == category_id)
    if not include_deleted:
        statement = statement.where(Category.deleted_at.is_(None))
    return (await session.scalars(statement)).one_or_none()


async def list_categories(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    cursor: PageCursor | None,
    include_archived: bool,
    kind: CategoryKind | None,
) -> list[Category]:
    statement = select(Category).where(Category.user_id == user_id, Category.deleted_at.is_(None))
    if not include_archived:
        statement = statement.where(Category.is_archived.is_(False))
    if kind is not None:
        statement = statement.where(Category.kind == kind)
    if cursor is not None:
        statement = statement.where(
            tuple_(Category.position, Category.created_at, Category.id)
            > tuple_(cursor.position, cursor.created_at, cursor.row_id)
        )
    statement = statement.order_by(Category.position, Category.created_at, Category.id).limit(limit)
    return list((await session.scalars(statement)).all())


async def name_is_taken(
    session: AsyncSession, user_id: UUID, kind: CategoryKind, name: str
) -> bool:
    statement = select(Category.id).where(
        Category.user_id == user_id,
        Category.kind == kind,
        Category.deleted_at.is_(None),
        func.lower(Category.name) == func.lower(name),
    )
    return (await session.scalars(statement)).first() is not None


async def add_category(session: AsyncSession, category: Category) -> None:
    session.add(category)
    await session.flush()


async def update_category(
    session: AsyncSession, user_id: UUID, category_id: UUID, changes: dict[str, object]
) -> Category | None:
    statement = (
        update(Category)
        .where(
            Category.user_id == user_id, Category.id == category_id, Category.deleted_at.is_(None)
        )
        .values(**changes, updated_at=func.now())
        .returning(Category)
        .execution_options(populate_existing=True, synchronize_session=False)
    )
    return (await session.scalars(statement)).one_or_none()


async def soft_delete_category(session: AsyncSession, user_id: UUID, category_id: UUID) -> None:
    await session.execute(
        update(Category)
        .where(
            Category.user_id == user_id, Category.id == category_id, Category.deleted_at.is_(None)
        )
        .values(deleted_at=func.now(), updated_at=func.now())
        .execution_options(synchronize_session=False)
    )
