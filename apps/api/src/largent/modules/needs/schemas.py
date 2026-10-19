"""Validated need API models."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
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
from largent.modules.needs.models import NeedPriority

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
