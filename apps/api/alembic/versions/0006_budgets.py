"""Create tenant-owned budgets pinned to expense categories by a composite foreign key."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from largent.db.rls import disable_tenant_rls, enable_tenant_rls

revision = "0006_budgets"
down_revision = "0005_transactions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "budgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "kind",
            postgresql.ENUM("income", "expense", name="category_kind", create_type=False),
            server_default="expense",
            nullable=False,
        ),
        sa.Column(
            "period", postgresql.ENUM("weekly", "monthly", name="budget_period"), nullable=False
        ),
        sa.Column("limit_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.CHAR(length=3), server_default="GHS", nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("kind = 'expense'", name=op.f("ck_budgets_kind_expense_only")),
        sa.CheckConstraint(
            "limit_minor > 0 AND limit_minor <= 1000000000000",
            name=op.f("ck_budgets_limit_range"),
        ),
        sa.CheckConstraint("currency = 'GHS'", name=op.f("ck_budgets_currency_ghs_only")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_budgets_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id", "category_id", "kind"],
            ["categories.user_id", "categories.id", "categories.kind"],
            name=op.f("fk_budgets_user_id_category_id_kind_categories"),
            match="SIMPLE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_budgets")),
        sa.UniqueConstraint("user_id", "id", name=op.f("uq_budgets_user_id_id")),
    )
    op.create_index(op.f("ix_budgets_user_id"), "budgets", ["user_id"], unique=False)
    op.create_index(
        op.f("uq_budgets_user_id_category_id_period_active"),
        "budgets",
        ["user_id", "category_id", "period"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    enable_tenant_rls(op, "budgets")


def downgrade() -> None:
    disable_tenant_rls(op, "budgets")
    op.drop_table("budgets")
    postgresql.ENUM(name="budget_period").drop(op.get_bind(), checkfirst=True)
