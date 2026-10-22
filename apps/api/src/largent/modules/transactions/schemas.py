"""Validated transaction API models."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StrictInt, model_validator

from largent.core.ids import ClientId
from largent.core.strings import normalize_text
from largent.domain.money import MAX_AMOUNT_MINOR, Currency
from largent.modules.transactions.models import MAX_NOTE_LENGTH, Transaction, TransactionKind

_ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def _require_plain_date(value: object) -> object:
    """Only `YYYY-MM-DD` strings; no timestamps, datetimes or numbers."""
    if isinstance(value, str) and not _ISO_DATE.fullmatch(value):
        raise ValueError("date must be YYYY-MM-DD")
    if not isinstance(value, str | date) or isinstance(value, datetime):
        raise ValueError("date must be YYYY-MM-DD")
    return value


PositiveAmount = Annotated[StrictInt, Field(ge=1, le=MAX_AMOUNT_MINOR)]
LocalDate = Annotated[date, BeforeValidator(_require_plain_date)]
Note = Annotated[
    str, BeforeValidator(normalize_text), Field(min_length=1, max_length=MAX_NOTE_LENGTH)
]


class TransactionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: ClientId | None = None
    account_id: UUID
    category_id: UUID | None = None
    kind: TransactionKind
    amount_minor: PositiveAmount
    currency: Currency = "GHS"
    occurred_on: LocalDate
    note: Note | None = None


class TransactionUpdate(BaseModel):
    """Partial update. `category_id` and `note` may be null to clear; `currency` is not editable."""

    model_config = ConfigDict(extra="forbid")

    account_id: UUID | None = None
    category_id: UUID | None = None
    kind: TransactionKind | None = None
    amount_minor: PositiveAmount | None = None
    occurred_on: LocalDate | None = None
    note: Note | None = None

    @model_validator(mode="after")
    def require_valid_changes(self) -> TransactionUpdate:
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        if any(getattr(self, f) is None for f in self.model_fields_set - {"category_id", "note"}):
            raise ValueError("fields cannot be null")
        return self


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    category_id: UUID | None
    kind: TransactionKind
    amount_minor: int
    currency: Currency
    occurred_on: date
    note: str | None
    created_at: datetime
    updated_at: datetime


def transaction_read(
    transaction: Transaction, account_name: str, category_name: str | None
) -> TransactionRead:
    return TransactionRead.model_validate(
        {
            "id": transaction.id,
            "account_id": transaction.account_id,
            "category_id": transaction.category_id,
            "kind": transaction.kind,
            "amount_minor": transaction.amount_minor,
            "currency": transaction.currency,
            "occurred_on": transaction.occurred_on,
            "note": transaction.note,
            "created_at": transaction.created_at,
            "updated_at": transaction.updated_at,
        }
    )


class TransactionPage(BaseModel):
    items: list[TransactionRead]
    limit: int
    next_cursor: str | None
