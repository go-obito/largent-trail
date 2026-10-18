"""Tenant-owned income and expense transaction persistence model."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import (
    CHAR,
    BigInteger,
    CheckConstraint,
    Date,
    Enum,
    ForeignKeyConstraint,
    Index,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from largent.db.base import Base, SyncedMixin, TenantMixin, synced_tenant_table_args
from largent.domain.money import MAX_AMOUNT_MINOR
from largent.modules.categories.models import CategoryKind

# Shares the `category_kind` Postgres enum: the composite FK to categories compares kinds.
TransactionKind = CategoryKind
MAX_NOTE_LENGTH = 280


class Transaction(TenantMixin, SyncedMixin, Base):
    __tablename__ = "transactions"
    __table_args__ = synced_tenant_table_args(
        "transactions",
        CheckConstraint(
            f"amount_minor > 0 AND amount_minor <= {MAX_AMOUNT_MINOR}", name="amount_range"
        ),
        CheckConstraint("currency = 'GHS'", name="currency_ghs_only"),
        CheckConstraint(
            f"note IS NULL OR char_length(note) BETWEEN 1 AND {MAX_NOTE_LENGTH}", name="note_length"
        ),
        ForeignKeyConstraint(
            ["user_id", "account_id"],
            ["accounts.user_id", "accounts.id"],
            name="fk_transactions_user_id_account_id_accounts",
        ),
        ForeignKeyConstraint(
            ["user_id", "category_id", "kind"],
            ["categories.user_id", "categories.id", "categories.kind"],
            name="fk_transactions_user_id_category_id_kind_categories",
            match="SIMPLE",
        ),
        Index(
            "ix_transactions_user_id_list_order",
            "user_id",
            text("occurred_on DESC"),
            text("created_at DESC"),
            text("id DESC"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_transactions_user_id_account_id_occurred_on",
            "user_id",
            "account_id",
            "occurred_on",
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_transactions_user_id_category_id_occurred_on",
            "user_id",
            "category_id",
            "occurred_on",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    account_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True))
    category_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True))
    kind: Mapped[TransactionKind] = mapped_column(
        Enum(CategoryKind, name="category_kind", values_callable=lambda e: [m.value for m in e])
    )
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(CHAR(3), server_default="GHS")
    occurred_on: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(Text)
