"""Create tenant-owned categories."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from largent.db.rls import disable_tenant_rls, enable_tenant_rls

revision = "0003_categories"
down_revision = "0002_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    category_kind = postgresql.ENUM("income", "expense", name="category_kind")
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", category_kind, nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("icon", sa.Text(), nullable=True),
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
            "icon IS NULL OR char_length(icon) BETWEEN 1 AND 32",
            name=op.f("ck_categories_icon_length"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_categories_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
        sa.UniqueConstraint("user_id", "id", name=op.f("uq_categories_user_id_id")),
    )
    op.create_index(op.f("ix_categories_user_id"), "categories", ["user_id"], unique=False)
    op.create_index(
        op.f("uq_categories_user_id_kind_lower_name_active"),
        "categories",
        ["user_id", "kind", sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    enable_tenant_rls(op, "categories")


def downgrade() -> None:
    disable_tenant_rls(op, "categories")
    op.drop_table("categories")
    postgresql.ENUM(name="category_kind").drop(op.get_bind(), checkfirst=True)
