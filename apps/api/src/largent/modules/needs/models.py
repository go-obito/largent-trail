"""Tenant-owned prioritized need (wishlist item) persistence model."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKeyConstraint,
    Index,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from largent.db.base import Base, SyncedMixin, TenantMixin, synced_tenant_table_args
from largent.domain.money import MAX_AMOUNT_MINOR


class NeedPriority(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Need(TenantMixin, SyncedMixin, Base):
    __tablename__ = "needs"
    __table_args__ = synced_tenant_table_args(
        "needs",
        CheckConstraint(
            f"target_minor > 0 AND target_minor <= {MAX_AMOUNT_MINOR}", name="target_range"
        ),
        Index(
            "ix_needs_user_id_position_id_active",
            "user_id",
            "position",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    name: Mapped[str] = mapped_column(Text)
    target_minor: Mapped[int] = mapped_column(BigInteger)
    priority: Mapped[NeedPriority] = mapped_column(
        Enum(NeedPriority, name="need_priority", values_callable=lambda e: [m.value for m in e]),
        default=NeedPriority.MEDIUM,
        server_default="medium",
    )
    position: Mapped[int] = mapped_column(BigInteger)
    note: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)


class AllocationKind(StrEnum):
    ALLOCATE = "allocate"
    RELEASE = "release"


class NeedAllocation(TenantMixin, Base):
    """Append-only ledger row; the app role can only select and insert."""

    __tablename__ = "need_allocations"
    __table_args__ = (
        UniqueConstraint("user_id", "id", name="uq_need_allocations_user_id_id"),
        CheckConstraint(
            f"amount_minor > 0 AND amount_minor <= {MAX_AMOUNT_MINOR}", name="amount_range"
        ),
        ForeignKeyConstraint(
            ["user_id", "need_id"],
            ["needs.user_id", "needs.id"],
            name="fk_need_allocations_user_id_need_id_needs",
        ),
        Index(
            "ix_need_allocations_user_id_need_id_created_at_id",
            "user_id",
            "need_id",
            text("created_at DESC"),
            text("id DESC"),
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    need_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True))
    kind: Mapped[AllocationKind] = mapped_column(
        Enum(AllocationKind, name="allocation_kind", values_callable=lambda e: [m.value for m in e])
    )
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
