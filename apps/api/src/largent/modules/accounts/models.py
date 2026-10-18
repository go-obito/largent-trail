"""Tenant-owned account persistence model."""

from __future__ import annotations

from enum import StrEnum

from sqlalchemy import CHAR, BigInteger, CheckConstraint, Enum, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from largent.db.base import Base, SyncedMixin, TenantMixin, synced_tenant_table_args


class AccountType(StrEnum):
    CASH = "cash"
    BANK = "bank"
    MOBILE_MONEY = "mobile_money"
    OTHER = "other"


class Account(TenantMixin, SyncedMixin, Base):
    __tablename__ = "accounts"
    __table_args__ = synced_tenant_table_args(
        "accounts",
        CheckConstraint("opening_balance_minor >= 0", name="opening_balance_nonnegative"),
        CheckConstraint("currency = 'GHS'", name="currency_ghs_only"),
        Index(
            "uq_accounts_user_id_lower_name_active",
            "user_id",
            text("lower(name)"),
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    name: Mapped[str] = mapped_column(String(60))
    type: Mapped[AccountType] = mapped_column(
        Enum(AccountType, name="account_type", values_callable=lambda e: [m.value for m in e])
    )
    opening_balance_minor: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))
    currency: Mapped[str] = mapped_column(CHAR(3), server_default="GHS")
    is_archived: Mapped[bool] = mapped_column(server_default=text("false"))
    position: Mapped[int] = mapped_column(server_default=text("0"))
