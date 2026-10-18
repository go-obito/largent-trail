"""Validated user profile request and response models."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str | None
    display_name: str | None
    timezone: str
    currency: str
    created_at: datetime


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    display_name: Annotated[str, Field(min_length=1, max_length=100)] | None = None
    timezone: Annotated[str, Field(min_length=1, max_length=100)] | None = None

    @field_validator("display_name", "timezone", mode="before")
    @classmethod
    def reject_null_values(cls, value: object) -> object:
        if value is None:
            raise ValueError("must be a non-null string when supplied")
        return value

    @field_validator("timezone")
    @classmethod
    def require_iana_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ValueError, ZoneInfoNotFoundError) as exc:
            raise ValueError("must be a valid IANA timezone") from exc
        return value

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> UserUpdate:
        if not self.model_fields_set:
            raise ValueError("at least one profile field must be provided")
        return self
