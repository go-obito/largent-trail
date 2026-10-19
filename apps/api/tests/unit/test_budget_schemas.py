"""Budget request and response models."""

from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from largent.core.ids import new_uuid7
from largent.modules.budgets.models import BudgetPeriod
from largent.modules.budgets.schemas import BudgetCreate, BudgetUpdate

BASE = {"category_id": str(uuid4()), "period": "weekly", "limit_minor": 7800}


def test_create_defaults() -> None:
    budget = BudgetCreate.model_validate(BASE)

    assert budget.id is None
    assert budget.period is BudgetPeriod.WEEKLY
    assert budget.currency == "GHS"
    assert budget.is_archived is False


def test_the_limit_bounds() -> None:
    assert BudgetCreate.model_validate({**BASE, "limit_minor": 1}).limit_minor == 1
    assert BudgetCreate.model_validate({**BASE, "limit_minor": 10**12}).limit_minor == 10**12


@pytest.mark.parametrize(
    "overrides",
    [
        {"limit_minor": 0},
        {"limit_minor": -5},
        {"limit_minor": 10**12 + 1},
        {"limit_minor": 12.5},
        {"limit_minor": 100.0},
        {"limit_minor": "100"},
        {"limit_minor": True},
        {"limit_minor": None},
        {"period": "daily"},
        {"period": "WEEKLY"},
        {"period": None},
        {"currency": "USD"},
        {"is_archived": "yes"},
        {"id": str(uuid4())},
        {"category_id": "not-a-uuid"},
        {"category_id": None},
        {"kind": "income"},
        {"user_id": str(uuid4())},
        {"spent_minor": 5},
        {"status": "within"},
        {"deleted_at": None},
    ],
)
def test_create_rejects_invalid_values(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        BudgetCreate.model_validate({**BASE, **overrides})


@pytest.mark.parametrize("missing", ["category_id", "period", "limit_minor"])
def test_create_requires_the_mandatory_fields(missing: str) -> None:
    payload = {k: v for k, v in BASE.items() if k != missing}

    with pytest.raises(ValidationError):
        BudgetCreate.model_validate(payload)


def test_create_accepts_a_client_uuid7_id() -> None:
    assert BudgetCreate.model_validate({**BASE, "id": str(new_uuid7())}).id is not None


def test_update_accepts_the_editable_fields() -> None:
    update = BudgetUpdate.model_validate({"limit_minor": 100, "is_archived": True})

    assert update.model_fields_set == {"limit_minor", "is_archived"}


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"limit_minor": None},
        {"is_archived": None},
        {"limit_minor": 0},
        {"limit_minor": 10**12 + 1},
        {"limit_minor": 1.5},
        {"category_id": str(uuid4())},
        {"period": "monthly"},
        {"currency": "GHS"},
        {"id": str(new_uuid7())},
        {"user_id": str(uuid4())},
        {"spent_minor": 1},
    ],
)
def test_update_rejects_invalid_payloads(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        BudgetUpdate.model_validate(payload)
