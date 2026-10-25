"""Tests for database role bootstrap URL validation."""

from __future__ import annotations

import pytest

from largent.db.bootstrap import _require_role_url, _required_url


def test_required_url_normalizes_railway_postgres_scheme(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_BOOTSTRAP_URL", "postgres://admin:secret@db.example/railway")

    url = _required_url("DATABASE_BOOTSTRAP_URL")

    assert url.drivername == "postgresql+asyncpg"
    assert url.username == "admin"
    assert url.database == "railway"


def test_required_url_rejects_non_postgres_scheme(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_BOOTSTRAP_URL", "redis://localhost:6379/0")

    with pytest.raises(RuntimeError, match="PostgreSQL URL"):
        _required_url("DATABASE_BOOTSTRAP_URL")


@pytest.mark.parametrize(
    ("value", "message"),
    [
        ("postgresql://postgres:secret@db.example/railway", "must connect as largent_app"),
        ("postgresql://largent_app@db.example/railway", "must include the password"),
    ],
)
def test_role_url_requires_expected_role_and_password(
    monkeypatch: pytest.MonkeyPatch, value: str, message: str
) -> None:
    monkeypatch.setenv("DATABASE_URL", value)

    with pytest.raises(RuntimeError, match=message):
        _require_role_url("DATABASE_URL", "largent_app")
