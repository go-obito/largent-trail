"""Tenant-owned expense budget persistence model."""

from __future__ import annotations

from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CHAR,
    BigInteger,
    CheckConstraint,
    Enum,
    ForeignKeyConstraint,
    Index,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from largent.db.base import Base, SyncedMixin, TenantMixin, synced_tenant_table_args
from largent.domain.money import MAX_AMOUNT_MINOR
from largent.modules.categories.models import CategoryKind


class BudgetPeriod(StrEnum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class Budget(TenantMixin, SyncedMixin, Base):
    __tablename__ = "budgets"
    __table_args__ = synced_tenant_table_args(
        "budgets",
        CheckConstraint("kind = 'expense'", name="kind_expense_only"),
        CheckConstraint(
            f"limit_minor > 0 AND limit_minor <= {MAX_AMOUNT_MINOR}", name="limit_range"
        ),
        CheckConstraint("currency = 'GHS'", name="currency_ghs_only"),
        # The kind column only exists so this FK can pin the category to an expense category.
        ForeignKeyConstraint(
            ["user_id", "category_id", "kind"],
            ["categories.user_id", "categories.id", "categories.kind"],
            name="fk_budgets_user_id_category_id_kind_categories",
            match="SIMPLE",
        ),
        Index(
            "uq_budgets_user_id_category_id_period_active",
            "user_id",
            "category_id",
            "period",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    category_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True))
    kind: Mapped[CategoryKind] = mapped_column(
        Enum(CategoryKind, name="category_kind", values_callable=lambda e: [m.value for m in e]),
        default=CategoryKind.EXPENSE,
        server_default="expense",
    )
    period: Mapped[BudgetPeriod] = mapped_column(
        Enum(BudgetPeriod, name="budget_period", values_callable=lambda e: [m.value for m in e])
    )
    limit_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(CHAR(3), server_default="GHS")
    is_archived: Mapped[bool] = mapped_column(server_default=text("false"))
