"""Pure daily target and budget status rules."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from largent.domain.daily_target import (
    DailyTarget,
    budget_status,
    daily_target,
    weekly_budget_total,
)
from largent.domain.periods import days_in_month
from largent.domain.transaction_rules import local_today

MONDAY = date(2026, 10, 19)
SUNDAY = date(2026, 10, 25)


def _target(
    today: date,
    weekly: list[int],
    monthly: list[int] | None = None,
    before: int = 0,
    spent: int = 0,
) -> DailyTarget:
    return daily_target(weekly, monthly or [], before, spent, today, days_in_month(today))


def test_reference_case_monday_nothing_spent_earlier() -> None:
    result = _target(MONDAY, [7800, 20000], spent=1300)

    assert result == DailyTarget(3971, 2671, "within_target")


def test_midweek_spreads_remaining_budget_over_days_left() -> None:
    wednesday = date(2026, 10, 21)

    result = _target(wednesday, [27800], before=6000, spent=1000)

    assert result == DailyTarget(4360, 3360, "within_target")


def test_sunday_target_is_whatever_is_left() -> None:
    result = _target(SUNDAY, [27800], before=20000)

    assert result.target_minor == 7800


def test_overspent_week_floors_target_at_zero() -> None:
    result = _target(date(2026, 10, 22), [10000], before=15000, spent=500)

    assert result == DailyTarget(0, -500, "over_target")


def test_overspent_week_with_nothing_spent_today_is_not_a_warning() -> None:
    result = _target(date(2026, 10, 22), [10000], before=15000)

    assert result == DailyTarget(0, 0, "within_target")


@pytest.mark.parametrize("before", [0, 5000])
def test_no_budgets_gives_no_target_rather_than_zero(before: int) -> None:
    result = _target(MONDAY, [], before=before, spent=1000)

    assert result == DailyTarget(None, None, None)


def test_monthly_budgets_are_prorated_and_floored() -> None:
    assert weekly_budget_total([], [10000], 31) == 2258
    assert weekly_budget_total([], [10000], 28) == 2500
    assert weekly_budget_total([100], [10000, 1], 30) == 100 + 2333 + 0


def test_monthly_budget_prorated_to_zero_still_counts_as_a_budget() -> None:
    result = _target(MONDAY, [], [1])

    assert result.target_minor == 0


def test_weekly_and_monthly_budgets_combine() -> None:
    result = _target(MONDAY, [7800], [10000])

    assert result.target_minor == (7800 + 2258) // 7


def test_timezone_boundary_picks_the_users_local_week() -> None:
    instant = datetime(2026, 10, 18, 23, 30, tzinfo=UTC)

    accra = _target(local_today(instant, "Africa/Accra"), [7000])
    kiritimati = _target(local_today(instant, "Pacific/Kiritimati"), [7000])

    assert accra.target_minor == 7000  # Sunday: one day left
    assert kiritimati.target_minor == 1000  # Monday: seven days left


@pytest.mark.parametrize(
    ("spent", "status"),
    [
        (0, "within_target"),
        (3176, "within_target"),
        (3177, "near_limit"),
        (3971, "near_limit"),
        (3972, "over_target"),
    ],
)
def test_daily_status_thresholds(spent: int, status: str) -> None:
    result = _target(MONDAY, [27800], spent=spent)

    assert result.target_minor == 3971
    assert result.status == status


@pytest.mark.parametrize(
    ("spent", "limit", "status"),
    [
        (0, 1000, "within"),
        (799, 1000, "within"),
        (800, 1000, "near_limit"),
        (1000, 1000, "near_limit"),
        (1001, 1000, "over_limit"),
        (4, 5, "near_limit"),
        (3, 5, "within"),
    ],
)
def test_budget_status_thresholds(spent: int, limit: int, status: str) -> None:
    assert budget_status(spent, limit) == status


@pytest.mark.parametrize("limit", [0, -1, True])
def test_budget_status_requires_a_positive_integer_limit(limit: int) -> None:
    with pytest.raises(ValueError, match="limit"):
        budget_status(0, limit)


def test_invalid_inputs_are_rejected() -> None:
    with pytest.raises(ValueError, match="spent_today"):
        _target(MONDAY, [100], spent=-1)
    with pytest.raises(ValueError, match="spent_before_today"):
        _target(MONDAY, [100], before=-1)
    with pytest.raises(ValueError, match="limit"):
        _target(MONDAY, [-100])
    with pytest.raises(ValueError, match="days_in_month"):
        daily_target([100], [], 0, 0, MONDAY, 32)
    with pytest.raises(ValueError, match="spent"):
        budget_status(-1, 100)
