"""Declarative base and shared tenant ownership column."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column

from largent.core.db import metadata


class Base(DeclarativeBase):
    """Declarative base using the application's shared naming conventions."""

    metadata = metadata


class TenantMixin:
    """Required owner column for tenant tables; B2 adds its users foreign key."""

    @declared_attr
    @classmethod
    def user_id(cls) -> Mapped[UUID]:
        return mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
