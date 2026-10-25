"""Configuration validation tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError
from tests.conftest import make_settings

from largent.core.config import Settings, WorkerConfig

KEY_A = "a" * 32
KEY_B = "b" * 32
BASE_ENV = {
    "ENVIRONMENT": "test",
    "LOG_LEVEL": "INFO",
    "DATABASE_URL": "postgresql+asyncpg://app:secret@localhost/largent",
    "MIGRATION_DATABASE_URL": "postgresql+asyncpg://migrator:secret@localhost/largent",
    "REDIS_URL": "redis://localhost:6379/0",
    "CORS_ALLOWED_ORIGINS": '["http://localhost:3000"]',
    "CLERK_ISSUER": "https://clerk.test",
    "CLERK_AUDIENCE": "largent-api",
    "CLERK_AUTHORIZED_PARTIES": '["http://localhost:3000"]',
}
VALID_ENV = {**BASE_ENV, "CURSOR_SIGNING_KEYS": KEY_A}
REQUIRED_ENV_NAMES = [
    "ENVIRONMENT",
    "LOG_LEVEL",
    "DATABASE_URL",
    "MIGRATION_DATABASE_URL",
    "REDIS_URL",
    "CORS_ALLOWED_ORIGINS",
    "CLERK_ISSUER",
    "CLERK_AUTHORIZED_PARTIES",
    "CURSOR_SIGNING_KEYS",
]
SETTING_ENV_NAMES = sorted(
    {
        name
        for field_name, field in Settings.model_fields.items()
        for name in (field_name, field.alias)
        if name
    }
)


@pytest.fixture(autouse=True)
def _clean_settings_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in SETTING_ENV_NAMES:
        monkeypatch.delenv(name, raising=False)


def _settings_from_env(monkeypatch: pytest.MonkeyPatch, **overrides: str) -> Settings:
    for name, value in {**BASE_ENV, **overrides}.items():
        monkeypatch.setenv(name, value)
    return Settings(_env_file=None)


def test_the_valid_environment_builds_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    assert _settings_from_env(monkeypatch, CURSOR_SIGNING_KEYS=KEY_A).environment == "test"


def test_required_names_cover_every_variable_without_a_default() -> None:
    required = {field.alias for field in Settings.model_fields.values() if field.is_required()} | {
        "CLERK_ISSUER",
        "CLERK_AUTHORIZED_PARTIES",
    }

    assert required == set(REQUIRED_ENV_NAMES)


def test_clerk_audience_is_optional(monkeypatch: pytest.MonkeyPatch) -> None:
    for name, value in VALID_ENV.items():
        if name != "CLERK_AUDIENCE":
            monkeypatch.setenv(name, value)

    assert Settings(_env_file=None).clerk_audience is None


@pytest.mark.parametrize(
    ("input_url", "expected_url"),
    [
        (
            "postgres://sample@db.example:5432/largent",
            "postgresql+asyncpg://sample@db.example:5432/largent",
        ),
        (
            "postgresql://sample@db.example:5432/largent",
            "postgresql+asyncpg://sample@db.example:5432/largent",
        ),
        (
            "postgresql+asyncpg://sample@db.example:5432/largent",
            "postgresql+asyncpg://sample@db.example:5432/largent",
        ),
    ],
)
def test_settings_normalize_railway_postgres_urls(
    monkeypatch: pytest.MonkeyPatch, input_url: str, expected_url: str
) -> None:
    settings = _settings_from_env(
        monkeypatch,
        DATABASE_URL=input_url,
        MIGRATION_DATABASE_URL=f"  {input_url}  ",
        CURSOR_SIGNING_KEYS=KEY_A,
    )

    assert settings.database_url == expected_url
    assert settings.migration_database_url == expected_url


@pytest.mark.parametrize(
    ("input_url", "expected_url"),
    [
        (
            "postgres://sample@db.example:5432/largent",
            "postgresql+asyncpg://sample@db.example:5432/largent",
        ),
        (
            "postgresql://sample@db.example:5432/largent",
            "postgresql+asyncpg://sample@db.example:5432/largent",
        ),
    ],
)
def test_worker_config_normalizes_railway_postgres_url(
    monkeypatch: pytest.MonkeyPatch, input_url: str, expected_url: str
) -> None:
    monkeypatch.setenv("DATABASE_URL", input_url)
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")

    assert WorkerConfig(_env_file=None).database_url == expected_url


def test_worker_config_needs_only_database_and_redis_urls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", BASE_ENV["DATABASE_URL"])
    monkeypatch.setenv("REDIS_URL", BASE_ENV["REDIS_URL"])

    config = WorkerConfig(_env_file=None)

    assert config.redis_url == BASE_ENV["REDIS_URL"]
    monkeypatch.setenv("REDIS_URL", "http://localhost")
    with pytest.raises(ValidationError, match="REDIS_URL"):
        WorkerConfig(_env_file=None)


def test_empty_environment_fails() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


@pytest.mark.parametrize("missing", REQUIRED_ENV_NAMES)
def test_missing_required_setting_fails(monkeypatch: pytest.MonkeyPatch, missing: str) -> None:
    for name, value in VALID_ENV.items():
        if name != missing:
            monkeypatch.setenv(name, value)

    with pytest.raises(ValidationError, match=missing):
        Settings(_env_file=None)


def test_cors_wildcard_is_rejected() -> None:
    with pytest.raises(ValidationError):
        make_settings(cors_allowed_origins=["*"])


def test_cursor_signing_keys_are_required_with_no_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(ValidationError, match="CURSOR_SIGNING_KEYS"):
        _settings_from_env(monkeypatch)


def test_cursor_signing_keys_are_required_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValidationError, match="CURSOR_SIGNING_KEYS"):
        _settings_from_env(monkeypatch, ENVIRONMENT="production")


def test_cursor_signing_keys_parse_from_a_comma_separated_environment_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = _settings_from_env(monkeypatch, CURSOR_SIGNING_KEYS=f" {KEY_A} , {KEY_B} ,")

    assert settings.cursor_signing_keys == [KEY_A, KEY_B]
    assert settings.cursor_signing_key_bytes == [KEY_A.encode(), KEY_B.encode()]


@pytest.mark.parametrize("value", [" , ", "short", f"{KEY_A},short", "é" * 15])
def test_cursor_signing_keys_that_are_empty_or_under_32_bytes_fail_startup(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    with pytest.raises(ValidationError, match="CURSOR_SIGNING_KEYS"):
        _settings_from_env(monkeypatch, CURSOR_SIGNING_KEYS=value)


def test_two_byte_characters_count_as_bytes_not_characters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = _settings_from_env(monkeypatch, CURSOR_SIGNING_KEYS="é" * 16)

    assert len(settings.cursor_signing_key_bytes[0]) == 32


def test_cursor_signing_keys_are_not_in_the_settings_repr() -> None:
    assert KEY_A not in repr(make_settings(cursor_signing_keys=[KEY_A]))
