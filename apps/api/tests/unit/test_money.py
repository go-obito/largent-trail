"""Tests for integer-pesewa domain helpers."""

from __future__ import annotations

import pytest

from largent.domain.money import MAX_AMOUNT_MINOR, account_balance, format_ghs, validate_minor


@pytest.mark.parametrize(
    ("opening", "income", "expense", "expected"),
    [
        (0, 0, 0, 0),
        (10_000, 2_500, 1_500, 11_000),
        (100, 0, 1_300, -1_200),
        (0, 3 * MAX_AMOUNT_MINOR, 0, 3 * MAX_AMOUNT_MINOR),
    ],
)
def test_account_balance_is_opening_plus_income_minus_expenses(
    opening: int, income: int, expense: int, expected: int
) -> None:
    assert account_balance(opening, income, expense) == expected


@pytest.mark.parametrize("value", [True, False, 1.0, "1", None, -1, MAX_AMOUNT_MINOR + 1])
def test_validate_minor_rejects_invalid_values(value: object) -> None:
    with pytest.raises(ValueError):
        validate_minor(value)


@pytest.mark.parametrize("value", [0, 1, MAX_AMOUNT_MINOR])
def test_validate_minor_accepts_bounded_integers(value: int) -> None:
    assert validate_minor(value) == value


def test_format_ghs_uses_integer_pesewas() -> None:
    assert format_ghs(13_000) == "₵130.00"
    assert format_ghs(5) == "₵0.05"


@pytest.mark.parametrize(
    ("minor", "expected"),
    [
        (0, "₵0.00"),
        (99, "₵0.99"),
        (100, "₵1.00"),
        (123_456, "₵1234.56"),
        (MAX_AMOUNT_MINOR, "₵10000000000.00"),
    ],
)
def test_format_ghs_edge_values(minor: int, expected: str) -> None:
    assert format_ghs(minor) == expected


@pytest.mark.parametrize("value", [-1, MAX_AMOUNT_MINOR + 1, True, 1.5])
def test_format_ghs_rejects_invalid_amounts(value: object) -> None:
    with pytest.raises(ValueError):
        format_ghs(value)  # type: ignore[arg-type]
