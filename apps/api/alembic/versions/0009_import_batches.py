"""Add tenant-scoped CSV import batch tracking."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from largent.db.rls import disable_tenant_rls, enable_tenant_rls

revision = "0009_import_batches"
down_revision = "0008_need_allocations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "import_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.Column("imported_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("skipped_duplicate_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("skipped_by_user_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("undone_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_import_batches_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id", "account_id"],
            ["accounts.user_id", "accounts.id"],
            name=op.f("fk_import_batches_user_id_account_id_accounts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_import_batches")),
        sa.UniqueConstraint("user_id", "id", name=op.f("uq_import_batches_user_id_id")),
        sa.UniqueConstraint(
            "user_id",
            "idempotency_key",
            name=op.f("uq_import_batches_user_id_idempotency_key"),
        ),
    )
    op.create_index(op.f("ix_import_batches_user_id"), "import_batches", ["user_id"])
    enable_tenant_rls(op, "import_batches")

    op.add_column(
        "transactions", sa.Column("import_batch_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column("transactions", sa.Column("import_hash", sa.Text(), nullable=True))
    op.create_foreign_key(
        op.f("fk_transactions_user_id_import_batch_id_import_batches"),
        "transactions",
        "import_batches",
        ["user_id", "import_batch_id"],
        ["user_id", "id"],
    )
    op.create_index(
        op.f("ix_transactions_user_id_import_hash"),
        "transactions",
        ["user_id", "import_hash"],
        postgresql_where=sa.text("import_hash IS NOT NULL AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_transactions_user_id_import_hash"), table_name="transactions")
    op.drop_constraint(
        op.f("fk_transactions_user_id_import_batch_id_import_batches"),
        "transactions",
        type_="foreignkey",
    )
    op.drop_column("transactions", "import_hash")
    op.drop_column("transactions", "import_batch_id")
    disable_tenant_rls(op, "import_batches")
    op.drop_table("import_batches")
