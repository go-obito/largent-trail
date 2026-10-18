"""Pure transaction date rules."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta, timezone

import pytest

from largent.domain.errors import DomainRuleViolation
from largent.domain.transaction_rules import check_occurred_on, local_today

TODAY = date(2026, 10, 18)


def test_local_today_follows_the_user_timezone() -> None:
    instant = datetime(2026, 10, 18, 23, 30, tzinfo=UTC)

    assert local_today(instant, "Africa/Accra") == date(2026, 10, 18)
    assert local_today(instant, "Pacific/Kiritimati") == date(2026, 10, 19)
    assert local_today(instant, "Pacific/Pago_Pago") == date(2026, 10, 18)
    assert local_today(instant.replace(hour=5), "Pacific/Pago_Pago") == date(2026, 10, 17)


def test_local_today_accepts_any_aware_offset() -> None:
    instant = datetime(2026, 10, 18, 23, 30, tzinfo=timezone(timedelta(hours=-5)))

    assert local_today(instant, "Africa/Accra") == date(2026, 10, 19)


def test_local_today_rejects_naive_datetimes() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        local_today(datetime(2026, 10, 18, 12, 0), "Africa/Accra")


@pytest.mark.parametrize(
    "occurred_on",
    [date(2000, 1, 1), date(2024, 2, 29), TODAY, TODAY + timedelta(days=1)],
)
def test_dates_inside_the_window_are_accepted(occurred_on: date) -> None:
    check_occurred_on(occurred_on, TODAY)


@pytest.mark.parametrize("occurred_on", [date(1999, 12, 31), TODAY + timedelta(days=2)])
def test_dates_outside_the_window_are_rejected(occurred_on: date) -> None:
    with pytest.raises(DomainRuleViolation) as failure:
        check_occurred_on(occurred_on, TODAY)

    assert failure.value.code == "invalid_date"
    assert failure.value.field == "occurred_on"
