"""Transaction request and response models."""

from __future__ import annotations

import unicodedata
from datetime import date
from uuid import uuid4

import pytest
from pydantic import ValidationError

from largent.core.ids import new_uuid7
from largent.modules.transactions.models import TransactionKind
from largent.modules.transactions.schemas import TransactionCreate, TransactionUpdate

BASE = {
    "account_id": str(uuid4()),
    "kind": "expense",
    "amount_minor": 1300,
    "occurred_on": "2026-10-18",
}


def test_create_defaults() -> None:
    transaction = TransactionCreate.model_validate(BASE)

    assert transaction.id is None
    assert transaction.category_id is None
    assert transaction.currency == "GHS"
    assert transaction.note is None
    assert transaction.kind is TransactionKind.EXPENSE
    assert transaction.occurred_on == date(2026, 10, 18)


def test_notes_are_nfc_normalized_and_trimmed() -> None:
    decomposed = unicodedata.normalize("NFD", "Café")

    transaction = TransactionCreate.model_validate({**BASE, "note": f"  {decomposed}\n"})

    assert transaction.note == "Café"


def test_the_amount_and_note_bounds() -> None:
    assert TransactionCreate.model_validate({**BASE, "amount_minor": 1}).amount_minor == 1
    assert TransactionCreate.model_validate({**BASE, "amount_minor": 10**12}).amount_minor == 10**12
    assert TransactionCreate.model_validate({**BASE, "note": "n" * 280}).note == "n" * 280


@pytest.mark.parametrize(
    "overrides",
    [
        {"amount_minor": 0},
        {"amount_minor": -5},
        {"amount_minor": 10**12 + 1},
        {"amount_minor": 12.5},
        {"amount_minor": 100.0},
        {"amount_minor": "100"},
        {"amount_minor": True},
        {"kind": "transfer"},
        {"kind": "EXPENSE"},
        {"currency": "USD"},
        {"occurred_on": "2026-13-01"},
        {"occurred_on": "18/10/2026"},
        {"occurred_on": "2026-10-18T10:00:00"},
        {"occurred_on": 1_760_000_000},
        {"occurred_on": None},
        {"note": ""},
        {"note": "   "},
        {"note": "n" * 281},
        {"note": 5},
        {"id": str(uuid4())},
        {"account_id": "not-a-uuid"},
        {"account_id": None},
        {"user_id": str(uuid4())},
        {"balance_minor": 5},
        {"deleted_at": None},
    ],
)
def test_create_rejects_invalid_values(overrides: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        TransactionCreate.model_validate({**BASE, **overrides})


def test_create_accepts_a_client_uuid7_id() -> None:
    transaction = TransactionCreate.model_validate({**BASE, "id": str(new_uuid7())})

    assert transaction.id is not None


def test_update_allows_clearing_only_the_category_and_note() -> None:
    update = TransactionUpdate.model_validate({"category_id": None, "note": None})

    assert update.model_fields_set == {"category_id", "note"}


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"account_id": None},
        {"kind": None},
        {"amount_minor": None},
        {"amount_minor": 0},
        {"occurred_on": None},
        {"currency": "GHS"},
        {"id": str(new_uuid7())},
        {"user_id": str(uuid4())},
        {"created_at": "2026-01-01T00:00:00Z"},
    ],
)
def test_update_rejects_invalid_payloads(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        TransactionUpdate.model_validate(payload)
