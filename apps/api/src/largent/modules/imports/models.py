"""Tenant-owned CSV import batch persistence."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    DateTime,
    ForeignKeyConstraint,
    Integer,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from largent.db.base import Base, TenantMixin


class ImportBatch(TenantMixin, Base):
    __tablename__ = "import_batches"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "account_id"],
            ["accounts.user_id", "accounts.id"],
            name="fk_import_batches_user_id_account_id_accounts",
        ),
        UniqueConstraint("user_id", "id", name="uq_import_batches_user_id_id"),
        UniqueConstraint(
            "user_id",
            "idempotency_key",
            name="uq_import_batches_user_id_idempotency_key",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    account_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True))
    idempotency_key: Mapped[str] = mapped_column(Text)
    imported_count: Mapped[int] = mapped_column(Integer, server_default="0")
    skipped_duplicate_count: Mapped[int] = mapped_column(Integer, server_default="0")
    skipped_by_user_count: Mapped[int] = mapped_column(Integer, server_default="0")
    error_count: Mapped[int] = mapped_column(Integer, server_default="0")
    errors: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, server_default="[]", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    undone_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
