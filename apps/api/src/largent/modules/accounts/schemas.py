"""Validated account API models."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    model_validator,
)

from largent.core.ids import ClientId
from largent.core.strings import normalize_text
from largent.domain.money import MAX_AMOUNT_MINOR, Currency
from largent.modules.accounts.models import AccountType

AccountName = Annotated[str, BeforeValidator(normalize_text), Field(min_length=1, max_length=60)]
MinorAmount = Annotated[StrictInt, Field(ge=0, le=MAX_AMOUNT_MINOR)]
Position = Annotated[StrictInt, Field(ge=0, le=1_000_000)]


class AccountCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: ClientId | None = None
    name: AccountName
    type: AccountType
    opening_balance_minor: MinorAmount = 0
    currency: Currency = "GHS"
    is_archived: StrictBool = False
    position: Position = 0


class AccountUpdate(BaseModel):
    """Partial update: omitted fields are untouched, null is not allowed."""

    model_config = ConfigDict(extra="forbid")

    name: AccountName | None = None
    type: AccountType | None = None
    opening_balance_minor: MinorAmount | None = None
    currency: Currency | None = None
    is_archived: StrictBool | None = None
    position: Position | None = None

    @model_validator(mode="after")
    def require_non_null_changes(self) -> AccountUpdate:
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("fields cannot be null")
        return self


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    type: AccountType
    opening_balance_minor: int
    currency: Currency
    is_archived: bool
    position: int
    created_at: datetime
    updated_at: datetime


class AccountPage(BaseModel):
    items: list[AccountRead]
    limit: int
    next_cursor: str | None
