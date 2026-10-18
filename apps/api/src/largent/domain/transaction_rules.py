"""Pure date rules for transactions; no I/O."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from largent.domain.errors import DomainRuleViolation

MIN_OCCURRED_ON = date(2000, 1, 1)
MAX_DAYS_AHEAD = 1


def local_today(now: datetime, timezone: str) -> date:
    """The calendar date it is right now in the given IANA timezone."""
    if now.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    return now.astimezone(ZoneInfo(timezone)).date()


def check_occurred_on(occurred_on: date, today: date) -> None:
    """Allow 2000-01-01 through the user's local today plus one day (for clock skew)."""
    if occurred_on < MIN_OCCURRED_ON or occurred_on > today + timedelta(days=MAX_DAYS_AHEAD):
        raise DomainRuleViolation("invalid_date", "occurred_on")
