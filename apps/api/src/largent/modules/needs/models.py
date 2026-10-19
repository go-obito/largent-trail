"""Tenant-owned prioritized need (wishlist item) persistence model."""

from __future__ import annotations

from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, Enum, Index, Text, text
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
