"""Tenant model base invariants."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from largent.core.db import metadata
from largent.db.base import Base, TenantMixin


class TenantModelFixture(TenantMixin, Base):
    __tablename__ = "tenant_model_fixture"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)


def test_tenant_mixin_is_indexed_non_null_uuid_with_user_cascade_foreign_key() -> None:
    user_id = TenantModelFixture.__table__.c.user_id

    assert Base.metadata is metadata
    assert isinstance(user_id.type, Uuid)
    assert user_id.nullable is False
    assert user_id.index is True
    user_foreign_key = next(iter(user_id.foreign_keys))
    assert user_foreign_key.target_fullname == "users.id"
    assert user_foreign_key.ondelete == "CASCADE"
