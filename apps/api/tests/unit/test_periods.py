"""Pure week/month boundaries."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from largent.domain.periods import (
    days_in_month,
    days_left_in_week,
    month_end,
    month_start,
    week_end,
    week_start,
)

MONDAY = date(2026, 10, 19)


@pytest.mark.parametrize("offset", range(7))
def test_every_day_of_a_week_maps_to_monday_through_sunday(offset: int) -> None:
    day = MONDAY + timedelta(days=offset)

    assert week_start(day) == MONDAY
    assert week_end(day) == date(2026, 10, 25)
    assert days_left_in_week(day) == 7 - offset


def test_week_crosses_month_and_year_boundaries() -> None:
    assert week_start(date(2026, 1, 1)) == date(2025, 12, 29)
    assert week_end(date(2026, 1, 1)) == date(2026, 1, 4)


@pytest.mark.parametrize(
    ("day", "days"),
    [
        (date(2026, 1, 15), 31),
        (date(2026, 2, 10), 28),
        (date(2028, 2, 10), 29),
        (date(2100, 2, 10), 28),
        (date(2026, 4, 30), 30),
    ],
)
def test_days_in_month_handles_leap_years(day: date, days: int) -> None:
    assert days_in_month(day) == days


def test_month_bounds() -> None:
    assert month_start(date(2026, 10, 19)) == date(2026, 10, 1)
    assert month_end(date(2026, 10, 19)) == date(2026, 10, 31)
    assert month_end(date(2028, 2, 3)) == date(2028, 2, 29)
    assert month_end(date(2026, 12, 31)) == date(2026, 12, 31)
