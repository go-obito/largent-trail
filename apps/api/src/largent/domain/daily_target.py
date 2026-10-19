"""Pure daily spending target and budget progress status; integer pesewas, all division floors."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Literal

from largent.domain.periods import DAYS_IN_WEEK, days_left_in_week

NEAR_LIMIT_PERCENT = 80
MIN_DAYS_IN_MONTH = 28
MAX_DAYS_IN_MONTH = 31

DailyStatus = Literal["within_target", "near_limit", "over_target"]
BudgetStatus = Literal["within", "near_limit", "over_limit"]


@dataclass(frozen=True, slots=True)
class DailyTarget:
    """`target_minor`, `left_today_minor` and `status` are all None when no budgets exist."""

    target_minor: int | None
    left_today_minor: int | None
    status: DailyStatus | None


def _check_non_negative(name: str, value: int) -> None:
    if type(value) is not int or value < 0:
        raise ValueError(f"{name} must be a non-negative integer")


def weekly_budget_total(
    weekly_limits: Sequence[int], monthly_limits: Sequence[int], days_in_month: int
) -> int:
    """Weekly limits plus monthly limits prorated to a week, each floored to the pesewa."""
    if not MIN_DAYS_IN_MONTH <= days_in_month <= MAX_DAYS_IN_MONTH:
        raise ValueError("days_in_month must be between 28 and 31")
    for limit in (*weekly_limits, *monthly_limits):
        _check_non_negative("limit", limit)
    return sum(weekly_limits) + sum(
        limit * DAYS_IN_WEEK // days_in_month for limit in monthly_limits
    )


def daily_target(
    weekly_limits: Sequence[int],
    monthly_limits: Sequence[int],
    spent_before_today: int,
    spent_today: int,
    today: date,
    days_in_month: int,
) -> DailyTarget:
    """Today's target is what is left of the weekly budget, spread over the days left."""
    _check_non_negative("spent_before_today", spent_before_today)
    _check_non_negative("spent_today", spent_today)
    if not weekly_limits and not monthly_limits:
        return DailyTarget(None, None, None)

    total = weekly_budget_total(weekly_limits, monthly_limits, days_in_month)
    target = max(0, (total - spent_before_today) // days_left_in_week(today))
    return DailyTarget(target, target - spent_today, _daily_status(spent_today, target))


def _daily_status(spent_today: int, target: int) -> DailyStatus:
    if spent_today > target:
        return "over_target"
    # Nothing spent is never a warning, even when the target has run out.
    if spent_today > 0 and spent_today * 100 >= target * NEAR_LIMIT_PERCENT:
        return "near_limit"
    return "within_target"


def budget_status(spent: int, limit: int) -> BudgetStatus:
    """`within` below 80% of the limit, `near_limit` up to and including it, `over_limit` above."""
    _check_non_negative("spent", spent)
    if type(limit) is not int or limit <= 0:
        raise ValueError("limit must be a positive integer")
    if spent > limit:
        return "over_limit"
    if spent * 100 >= limit * NEAR_LIMIT_PERCENT:
        return "near_limit"
    return "within"
