"""Tenant-owned flat category persistence model."""

from __future__ import annotations

from enum import StrEnum

from sqlalchemy import CheckConstraint, Enum, Index, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from largent.db.base import Base, SyncedMixin, TenantMixin, synced_tenant_table_args


class CategoryKind(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"


class Category(TenantMixin, SyncedMixin, Base):
    __tablename__ = "categories"
    __table_args__ = synced_tenant_table_args(
        "categories",
        # Target of transactions' (user_id, category_id, kind) composite foreign key.
        UniqueConstraint("user_id", "id", "kind", name="uq_categories_user_id_id_kind"),
        CheckConstraint("icon IS NULL OR char_length(icon) BETWEEN 1 AND 32", name="icon_length"),
        Index(
            "uq_categories_user_id_kind_lower_name_active",
            "user_id",
            "kind",
            text("lower(name)"),
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    kind: Mapped[CategoryKind] = mapped_column(
        Enum(CategoryKind, name="category_kind", values_callable=lambda e: [m.value for m in e])
    )
    name: Mapped[str] = mapped_column(String(60))
    icon: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(server_default=text("false"))
    position: Mapped[int] = mapped_column(server_default=text("0"))
