"""Add the one-time default-category seeding marker to users."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004_users_defaults_seeded_at"
down_revision = "0003_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("defaults_seeded_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("users", "defaults_seeded_at")
