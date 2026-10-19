"""need allocations

Revision ID: 0008_need_allocations
Revises: 0007_needs
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from largent.db.rls import disable_tenant_rls, enable_tenant_rls

revision = "0008_need_allocations"
down_revision = "0007_needs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "need_allocations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("need_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "kind",
            postgresql.ENUM("allocate", "release", name="allocation_kind"),
            nullable=False,
        ),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "amount_minor > 0 AND amount_minor <= 1000000000000",
            name=op.f("ck_need_allocations_amount_range"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_need_allocations_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id", "need_id"],
            ["needs.user_id", "needs.id"],
            name=op.f("fk_need_allocations_user_id_need_id_needs"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_need_allocations")),
        sa.UniqueConstraint("user_id", "id", name=op.f("uq_need_allocations_user_id_id")),
    )
    op.create_index(op.f("ix_need_allocations_user_id"), "need_allocations", ["user_id"])
    op.create_index(
        op.f("ix_need_allocations_user_id_need_id_created_at_id"),
        "need_allocations",
        ["user_id", "need_id", sa.text("created_at DESC"), sa.text("id DESC")],
    )
    enable_tenant_rls(op, "need_allocations")
    op.execute("REVOKE UPDATE, DELETE ON TABLE need_allocations FROM largent_app")


def downgrade() -> None:
    disable_tenant_rls(op, "need_allocations")
    op.drop_table("need_allocations")
    postgresql.ENUM(name="allocation_kind").drop(op.get_bind(), checkfirst=True)
