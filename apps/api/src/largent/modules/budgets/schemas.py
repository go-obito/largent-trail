"""Validated budget API models."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, model_validator

from largent.core.ids import ClientId
from largent.domain.daily_target import BudgetStatus
from largent.domain.money import MAX_AMOUNT_MINOR, Currency
from largent.modules.budgets.models import BudgetPeriod

LimitMinor = Annotated[StrictInt, Field(ge=1, le=MAX_AMOUNT_MINOR)]


class BudgetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: ClientId | None = None
    category_id: UUID
    period: BudgetPeriod
    limit_minor: LimitMinor
    currency: Currency = "GHS"
    is_archived: StrictBool = False


class BudgetUpdate(BaseModel):
    """Partial update. The category, period and currency of a budget are immutable."""

    model_config = ConfigDict(extra="forbid")

    limit_minor: LimitMinor | None = None
    is_archived: StrictBool | None = None

    @model_validator(mode="after")
    def require_valid_changes(self) -> BudgetUpdate:
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        if any(getattr(self, f) is None for f in self.model_fields_set):
            raise ValueError("fields cannot be null")
        return self


class BudgetRead(BaseModel):
    """`spent_minor` and `status` describe the budget's current week or month to date."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: UUID
    period: BudgetPeriod
    limit_minor: int
    currency: Currency
    is_archived: bool
    spent_minor: int
    status: BudgetStatus
    created_at: datetime
    updated_at: datetime


class BudgetPage(BaseModel):
    items: list[BudgetRead]
    limit: int
    next_cursor: str | None
