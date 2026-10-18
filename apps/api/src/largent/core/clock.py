"""Injectable wall clock so date rules are testable."""

from __future__ import annotations

from datetime import UTC, datetime


def utc_now() -> datetime:
    """FastAPI dependency: the current instant in UTC."""
    return datetime.now(UTC)
