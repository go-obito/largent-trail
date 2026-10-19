"""Pure calendar period boundaries; weeks start Monday. All ends are inclusive dates."""

from __future__ import annotations

import calendar
from datetime import date, timedelta

DAYS_IN_WEEK = 7


def week_start(day: date) -> date:
    """The Monday on or before `day`."""
    return day - timedelta(days=day.weekday())


def week_end(day: date) -> date:
    """The Sunday on or after `day`."""
    return week_start(day) + timedelta(days=DAYS_IN_WEEK - 1)


def days_left_in_week(day: date) -> int:
    """Days remaining in the week including `day` (7 on Monday, 1 on Sunday)."""
    return DAYS_IN_WEEK - day.weekday()


def days_in_month(day: date) -> int:
    """Number of days in the month containing `day`."""
    return calendar.monthrange(day.year, day.month)[1]


def month_start(day: date) -> date:
    """The first day of the month containing `day`."""
    return day.replace(day=1)


def month_end(day: date) -> date:
    """The last day of the month containing `day`."""
    return day.replace(day=days_in_month(day))
