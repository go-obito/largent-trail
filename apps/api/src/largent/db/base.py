"""Declarative base and shared tenant ownership column."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column
from sqlalchemy.sql.schema import SchemaItem

from largent.core.db import metadata


class Base(DeclarativeBase):
    """Declarative base using the application's shared naming conventions."""

    metadata = metadata


class SyncedMixin:
    """Client-synchronized row fields. `server_seq` is added for all synced tables in B8."""

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TenantMixin:
    """Required owner column for tenant tables; B2 adds its users foreign key."""

    @declared_attr
    @classmethod
    def user_id(cls) -> Mapped[UUID]:
        return mapped_column(
            Uuid(as_uuid=True),
            ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )


def synced_tenant_table_args(table_name: str, *extra: SchemaItem) -> tuple[SchemaItem, ...]:
    """Build `__table_args__` for a `TenantMixin` + `SyncedMixin` model.

    Always includes `UNIQUE (user_id, id)`, the target of child tables' composite foreign keys.
    """
    return (UniqueConstraint("user_id", "id", name=f"uq_{table_name}_user_id_id"), *extra)
