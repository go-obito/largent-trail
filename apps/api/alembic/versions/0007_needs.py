"""needs

Revision ID: 0007_needs
Revises: 0006_budgets
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from largent.db.rls import disable_tenant_rls, enable_tenant_rls

revision = "0007_needs"
down_revision = "0006_budgets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "needs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("target_minor", sa.BigInteger(), nullable=False),
        sa.Column(
            "priority",
            postgresql.ENUM("high", "medium", "low", name="need_priority"),
            server_default="medium",
            nullable=False,
        ),
        sa.Column("position", sa.BigInteger(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "target_minor > 0 AND target_minor <= 1000000000000",
            name=op.f("ck_needs_target_range"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_needs_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_needs")),
        sa.UniqueConstraint("user_id", "id", name=op.f("uq_needs_user_id_id")),
    )
    op.create_index(op.f("ix_needs_user_id"), "needs", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_needs_user_id_position_id_active"),
        "needs",
        ["user_id", "position", "id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    enable_tenant_rls(op, "needs")


def downgrade() -> None:
    disable_tenant_rls(op, "needs")
    op.drop_table("needs")
    postgresql.ENUM(name="need_priority").drop(op.get_bind(), checkfirst=True)
