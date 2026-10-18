"""Tenant model base invariants."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import DateTime, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from largent.core.db import metadata
from largent.db.base import Base, SyncedMixin, TenantMixin, synced_tenant_table_args


class TenantModelFixture(TenantMixin, Base):
    __tablename__ = "tenant_model_fixture"

    id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)


class SyncedTenantModelFixture(TenantMixin, SyncedMixin, Base):
    __tablename__ = "synced_tenant_model_fixture"
    __table_args__ = synced_tenant_table_args("synced_tenant_model_fixture")


def test_tenant_mixin_is_indexed_non_null_uuid_with_user_cascade_foreign_key() -> None:
    user_id = TenantModelFixture.__table__.c.user_id

    assert Base.metadata is metadata
    assert isinstance(user_id.type, Uuid)
    assert user_id.nullable is False
    assert user_id.index is True
    user_foreign_key = next(iter(user_id.foreign_keys))
    assert user_foreign_key.target_fullname == "users.id"
    assert user_foreign_key.ondelete == "CASCADE"


def test_synced_mixin_has_client_id_timestamps_and_soft_delete() -> None:
    table = SyncedTenantModelFixture.__table__

    assert isinstance(table.c.id.type, Uuid)
    assert table.c.id.primary_key is True
    assert isinstance(table.c.created_at.type, DateTime)
    assert table.c.created_at.server_default is not None
    assert table.c.updated_at.server_default is not None
    assert table.c.updated_at.onupdate is not None
    assert table.c.deleted_at.nullable is True
    assert "server_seq" not in table.c


def test_synced_tenant_tables_get_composite_unique_user_id_id() -> None:
    constraints = [
        constraint
        for constraint in metadata.tables["synced_tenant_model_fixture"].constraints
        if isinstance(constraint, UniqueConstraint)
    ]

    assert [[column.name for column in constraint.columns] for constraint in constraints] == [
        ["user_id", "id"]
    ]
