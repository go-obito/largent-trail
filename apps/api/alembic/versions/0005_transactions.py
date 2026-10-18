"""Create tenant-owned transactions with kind-enforcing composite foreign keys."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from largent.db.rls import disable_tenant_rls, enable_tenant_rls

revision = "0005_transactions"
down_revision = "0004_users_defaults_seeded_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The FK on (user_id, category_id, kind) needs a unique target and the same enum type.
    op.create_unique_constraint(
        op.f("uq_categories_user_id_id_kind"), "categories", ["user_id", "id", "kind"]
    )
    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "kind",
            postgresql.ENUM("income", "expense", name="category_kind", create_type=False),
            nullable=False,
        ),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.CHAR(length=3), server_default="GHS", nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "amount_minor > 0 AND amount_minor <= 1000000000000",
            name=op.f("ck_transactions_amount_range"),
        ),
        sa.CheckConstraint("currency = 'GHS'", name=op.f("ck_transactions_currency_ghs_only")),
        sa.CheckConstraint(
            "note IS NULL OR char_length(note) BETWEEN 1 AND 280",
            name=op.f("ck_transactions_note_length"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_transactions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id", "account_id"],
            ["accounts.user_id", "accounts.id"],
            name=op.f("fk_transactions_user_id_account_id_accounts"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id", "category_id", "kind"],
            ["categories.user_id", "categories.id", "categories.kind"],
            name=op.f("fk_transactions_user_id_category_id_kind_categories"),
            match="SIMPLE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_transactions")),
        sa.UniqueConstraint("user_id", "id", name=op.f("uq_transactions_user_id_id")),
    )
    op.create_index(op.f("ix_transactions_user_id"), "transactions", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_transactions_user_id_list_order"),
        "transactions",
        ["user_id", sa.text("occurred_on DESC"), sa.text("created_at DESC"), sa.text("id DESC")],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        op.f("ix_transactions_user_id_account_id_occurred_on"),
        "transactions",
        ["user_id", "account_id", "occurred_on"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        op.f("ix_transactions_user_id_category_id_occurred_on"),
        "transactions",
        ["user_id", "category_id", "occurred_on"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    enable_tenant_rls(op, "transactions")


def downgrade() -> None:
    disable_tenant_rls(op, "transactions")
    op.drop_table("transactions")
    op.drop_constraint(op.f("uq_categories_user_id_id_kind"), "categories", type_="unique")
