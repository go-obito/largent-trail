"""Account schema validation without a database."""

from __future__ import annotations

import unicodedata
from uuid import uuid4

import pytest
from pydantic import ValidationError

from largent.core.ids import new_uuid7
from largent.modules.accounts.schemas import AccountCreate, AccountUpdate


def test_create_defaults_match_the_database_defaults() -> None:
    account = AccountCreate.model_validate({"name": "Wallet", "type": "cash"})

    assert account.id is None
    assert account.opening_balance_minor == 0
    assert account.currency == "GHS"
    assert account.is_archived is False
    assert account.position == 0


def test_name_is_nfc_normalized_then_trimmed_then_length_checked() -> None:
    decomposed = unicodedata.normalize("NFD", "Café")

    account = AccountCreate.model_validate({"name": f" {decomposed} ", "type": "bank"})

    assert account.name == "Café"
    with pytest.raises(ValidationError):
        AccountCreate.model_validate({"name": " \u00a0 ", "type": "bank"})


def test_client_id_must_be_a_uuid7() -> None:
    valid = new_uuid7()

    assert AccountCreate.model_validate({"id": str(valid), "name": "A", "type": "cash"}).id == valid
    with pytest.raises(ValidationError):
        AccountCreate.model_validate({"id": str(uuid4()), "name": "A", "type": "cash"})


@pytest.mark.parametrize("amount", [True, 1.5, 100.0, "5", -1, 10**12 + 1])
def test_opening_balance_must_be_a_bounded_non_negative_integer(amount: object) -> None:
    with pytest.raises(ValidationError):
        AccountCreate.model_validate({"name": "A", "type": "cash", "opening_balance_minor": amount})


def test_unknown_fields_are_rejected_on_create_and_update() -> None:
    with pytest.raises(ValidationError):
        AccountCreate.model_validate({"name": "A", "type": "cash", "user_id": str(uuid4())})
    with pytest.raises(ValidationError):
        AccountUpdate.model_validate({"user_id": str(uuid4())})


def test_update_requires_at_least_one_non_null_field() -> None:
    with pytest.raises(ValidationError):
        AccountUpdate.model_validate({})
    with pytest.raises(ValidationError):
        AccountUpdate.model_validate({"name": None})
    assert AccountUpdate.model_validate({"position": 0}).model_dump(exclude_unset=True) == {
        "position": 0
    }
