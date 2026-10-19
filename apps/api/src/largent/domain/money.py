"""Pure integer-pesewa validation and GHS display formatting."""

from __future__ import annotations

from typing import Literal

MAX_AMOUNT_MINOR = 10**12
Currency = Literal["GHS"]


def validate_minor(value: object) -> int:
    """Return a valid non-negative pesewa amount, rejecting booleans explicitly."""
    if type(value) is not int or not 0 <= value <= MAX_AMOUNT_MINOR:
        raise ValueError("amount must be an integer between 0 and MAX_AMOUNT_MINOR")
    return value


def account_balance(opening_minor: int, income_minor: int, expense_minor: int) -> int:
    """Derived account balance in pesewas; it is signed because expenses may exceed funds."""
    return validate_minor(opening_minor) + income_minor - expense_minor


def format_ghs(minor: int) -> str:
    """Format integer pesewas as a GHS amount without floating-point arithmetic."""
    value = validate_minor(minor)
    return f"₵{value // 100}.{value % 100:02d}"
