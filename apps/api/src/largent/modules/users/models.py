"""SQLAlchemy model for the local identity-root user record."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import CHAR, CheckConstraint, DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from largent.db.base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("currency = 'GHS'", name="users_currency_ghs_only"),
        UniqueConstraint("auth_provider", "auth_subject", name="uq_users_provider_subject"),
    )

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    auth_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    auth_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(254))
    display_name: Mapped[str | None] = mapped_column(String(100))
    timezone: Mapped[str] = mapped_column(
        String(100), nullable=False, server_default="Africa/Accra"
    )
    currency: Mapped[str] = mapped_column(CHAR(3), nullable=False, server_default="GHS")
    defaults_seeded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
