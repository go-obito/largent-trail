"""Validated need API models."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StrictInt,
    model_validator,
)

from largent.core.ids import ClientId
from largent.core.strings import normalize_text
from largent.domain.money import MAX_AMOUNT_MINOR
from largent.domain.needs import MAX_ACTIVE_NEEDS
from largent.modules.needs.models import AllocationKind, NeedPriority

NeedName = Annotated[str, BeforeValidator(normalize_text), Field(min_length=1, max_length=100)]
NeedNote = Annotated[str, BeforeValidator(normalize_text), Field(min_length=1, max_length=280)]
TargetMinor = Annotated[StrictInt, Field(ge=1, le=MAX_AMOUNT_MINOR)]


def _require_http_url(value: str) -> str:
    try:
        parts = urlsplit(value)
    except ValueError:
        raise ValueError("source_url must be a valid URL") from None
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise ValueError("source_url must be an http or https URL")
    if any(ord(c) < 33 or ord(c) == 127 for c in value):
        raise ValueError("source_url must not contain whitespace or control characters")
    return value


SourceUrl = Annotated[
    str,
    BeforeValidator(normalize_text),
    Field(min_length=1, max_length=2048),
    AfterValidator(_require_http_url),
]


class NeedCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: ClientId | None = None
    name: NeedName
    target_minor: TargetMinor
    priority: NeedPriority = NeedPriority.MEDIUM
    note: NeedNote | None = None
    source_url: SourceUrl | None = None


class NeedUpdate(BaseModel):
    """Partial update; `note` may be null to clear it."""

    model_config = ConfigDict(extra="forbid")

    name: NeedName | None = None
    target_minor: TargetMinor | None = None
    priority: NeedPriority | None = None
    note: NeedNote | None = None

    @model_validator(mode="after")
    def require_valid_changes(self) -> NeedUpdate:
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        if any(getattr(self, f) is None for f in self.model_fields_set - {"note"}):
            raise ValueError("fields cannot be null")
        return self


class NeedOrder(BaseModel):
    """The complete ordered list of the user's active need IDs."""

    model_config = ConfigDict(extra="forbid")

    ids: list[UUID] = Field(max_length=MAX_ACTIVE_NEEDS)


class NeedDeleteQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reconcile: Literal["release", "purchased"] | None = None
    account_id: UUID | None = None
    category_id: UUID | None = None
    occurred_on: date | None = None

    @model_validator(mode="after")
    def validate_reconciliation(self) -> NeedDeleteQuery:
        if self.reconcile == "purchased" and self.account_id is None:
            raise ValueError("account_id is required when reconcile is purchased")
        if self.reconcile != "purchased" and any(
            value is not None for value in (self.account_id, self.category_id, self.occurred_on)
        ):
            raise ValueError("purchase fields require reconcile=purchased")
        return self


class NeedRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    target_minor: int
    priority: NeedPriority
    position: int
    note: str | None
    source_url: str | None
    allocated_minor: int
    remaining_minor: int
    percent: int
    is_complete: bool
    created_at: datetime
    updated_at: datetime


class NeedList(BaseModel):
    items: list[NeedRead]


class AllocationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: ClientId | None = None
    kind: AllocationKind
    amount_minor: TargetMinor


class AllocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    need_id: UUID
    kind: AllocationKind
    amount_minor: int
    created_at: datetime


class AllocationPage(BaseModel):
    items: list[AllocationRead]
    limit: int
    next_cursor: str | None


class NeedSummary(BaseModel):
    savings_pool_minor: int
    total_allocated_minor: int
    unallocated_minor: int
    over_allocated: bool
    total_target_minor: int
    total_remaining_minor: int


class AllocationResult(BaseModel):
    need: NeedRead
    summary: NeedSummary


class LinkImportPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: Annotated[str, Field(min_length=8, max_length=2048)]


class LinkImportPreviewRead(BaseModel):
    """Product details extracted from an untrusted product page."""

    name: str | None
    target_minor: int | None
    price_minor: int | None
    price_currency: str | None
