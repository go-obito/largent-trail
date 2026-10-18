"""Create tenant-owned accounts."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from largent.db.rls import disable_tenant_rls, enable_tenant_rls

revision = "0002_accounts"
down_revision = "0001_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    account_type = postgresql.ENUM("cash", "bank", "mobile_money", "other", name="account_type")
    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("type", account_type, nullable=False),
        sa.Column(
            "opening_balance_minor", sa.BigInteger(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("currency", sa.CHAR(length=3), server_default="GHS", nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("position", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "opening_balance_minor >= 0", name=op.f("ck_accounts_opening_balance_nonnegative")
        ),
        sa.CheckConstraint("currency = 'GHS'", name=op.f("ck_accounts_currency_ghs_only")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_accounts_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_accounts")),
        sa.UniqueConstraint("user_id", "id", name=op.f("uq_accounts_user_id_id")),
    )
    op.create_index(op.f("ix_accounts_user_id"), "accounts", ["user_id"], unique=False)
    op.create_index(
        op.f("uq_accounts_user_id_lower_name_active"),
        "accounts",
        ["user_id", sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    enable_tenant_rls(op, "accounts")


def downgrade() -> None:
    disable_tenant_rls(op, "accounts")
    op.drop_table("accounts")
    postgresql.ENUM(name="account_type").drop(op.get_bind(), checkfirst=True)
