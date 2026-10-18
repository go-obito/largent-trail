"""Validated category API models."""

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
from largent.modules.categories.models import CategoryKind

CategoryName = Annotated[str, BeforeValidator(normalize_text), Field(min_length=1, max_length=60)]
CategoryIcon = Annotated[str, BeforeValidator(normalize_text), Field(min_length=1, max_length=32)]
Position = Annotated[StrictInt, Field(ge=0, le=1_000_000)]


class CategoryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: ClientId | None = None
    kind: CategoryKind
    name: CategoryName
    icon: CategoryIcon | None = None
    is_archived: StrictBool = False
    position: Position = 0


class CategoryUpdate(BaseModel):
    """Partial update. `kind` is immutable; `icon: null` clears the icon."""

    model_config = ConfigDict(extra="forbid")

    name: CategoryName | None = None
    icon: CategoryIcon | None = None
    is_archived: StrictBool | None = None
    position: Position | None = None

    @model_validator(mode="after")
    def require_valid_changes(self) -> CategoryUpdate:
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        if any(getattr(self, f) is None for f in self.model_fields_set - {"icon"}):
            raise ValueError("fields cannot be null")
        return self


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: CategoryKind
    name: str
    icon: str | None
    is_archived: bool
    position: int
    created_at: datetime
    updated_at: datetime


class CategoryPage(BaseModel):
    items: list[CategoryRead]
    limit: int
    next_cursor: str | None
