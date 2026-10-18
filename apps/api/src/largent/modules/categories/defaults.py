"""Categories every new user starts with; list order defines `position`."""

from __future__ import annotations

from largent.modules.categories.models import CategoryKind

DEFAULT_EXPENSE_CATEGORIES: tuple[str, ...] = (
    "Food",
    "Transport",
    "Airtime and Data",
    "Utilities",
    "Rent",
    "Health",
    "Education",
    "Shopping",
    "Entertainment",
    "Giving",
    "Family Support",
    "Savings",
    "Other",
)
DEFAULT_INCOME_CATEGORIES: tuple[str, ...] = ("Salary", "Business", "Gift", "Other")

DEFAULT_CATEGORIES: tuple[tuple[CategoryKind, str, int], ...] = (
    *((CategoryKind.EXPENSE, name, index) for index, name in enumerate(DEFAULT_EXPENSE_CATEGORIES)),
    *((CategoryKind.INCOME, name, index) for index, name in enumerate(DEFAULT_INCOME_CATEGORIES)),
)
