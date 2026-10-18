"""Category schema validation without a database."""

from __future__ import annotations

import unicodedata
from uuid import uuid4

import pytest
from pydantic import ValidationError

from largent.core.ids import new_uuid7
from largent.modules.categories.models import CategoryKind
from largent.modules.categories.schemas import CategoryCreate, CategoryUpdate


def test_create_defaults_and_kind_enum() -> None:
    category = CategoryCreate.model_validate({"kind": "income", "name": "Salary"})

    assert category.kind is CategoryKind.INCOME
    assert category.icon is None
    assert category.is_archived is False
    assert category.position == 0


def test_name_and_icon_are_nfc_normalized_and_trimmed() -> None:
    decomposed = unicodedata.normalize("NFD", "é")

    category = CategoryCreate.model_validate(
        {"kind": "expense", "name": f" {decomposed}t ", "icon": f" {decomposed} "}
    )

    assert category.name == "ét"
    assert category.icon == "é"


@pytest.mark.parametrize(
    "payload",
    [
        {"kind": "expense", "name": ""},
        {"kind": "expense", "name": "x" * 61},
        {"kind": "expense", "name": "A", "icon": "i" * 33},
        {"kind": "expense", "name": "A", "icon": ""},
        {"kind": "expense", "name": "A", "id": str(uuid4())},
        {"kind": "expense", "name": "A", "parent_id": str(new_uuid7())},
        {"kind": "other", "name": "A"},
    ],
)
def test_invalid_create_payloads_are_rejected(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        CategoryCreate.model_validate(payload)


def test_update_allows_clearing_the_icon_but_no_other_nulls_and_no_kind_change() -> None:
    assert CategoryUpdate.model_validate({"icon": None}).model_dump(exclude_unset=True) == {
        "icon": None
    }
    for payload in ({}, {"name": None}, {"position": None}, {"kind": "income"}):
        with pytest.raises(ValidationError):
            CategoryUpdate.model_validate(payload)
