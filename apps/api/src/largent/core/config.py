"""Validated process configuration."""

from __future__ import annotations

from pathlib import Path
from typing import Annotated, Literal

from pydantic import AnyUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_CONFIG_PATH = Path(__file__).resolve()
_ENV_FILE = next(
    (parent / ".env" for parent in _CONFIG_PATH.parents if (parent / ".env").is_file()),
    Path(".env"),
)


def _normalize_postgres_url(value: str) -> str:
    """Normalize common managed-Postgres URL schemes to SQLAlchemy's asyncpg scheme."""
    value = value.strip()
    if value.startswith("postgres://"):
        return "postgresql+asyncpg://" + value.removeprefix("postgres://")
    if value.startswith("postgresql://"):
        return "postgresql+asyncpg://" + value.removeprefix("postgresql://")
    return value


def _check_postgres_url(value: str) -> str:
    if not value.startswith("postgresql+asyncpg://"):
        msg = "must use the postgresql+asyncpg scheme after URL normalization"
        raise ValueError(msg)
    return value


def _check_redis_url(value: str) -> str:
    if not value.startswith(("redis://", "rediss://")):
        msg = "must use the redis or rediss scheme"
        raise ValueError(msg)
    return value


class WorkerConfig(BaseSettings):
    """The subset of process configuration the ARQ worker needs."""

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=_ENV_FILE,
        env_ignore_empty=True,
        extra="ignore",
        populate_by_name=True,
    )

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_postgres_url(cls, value: str) -> str:
        return _normalize_postgres_url(value)

    @field_validator("database_url")
    @classmethod
    def validate_postgres_url(cls, value: str) -> str:
        return _check_postgres_url(value)

    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, value: str) -> str:
        return _check_redis_url(value)


class Settings(BaseSettings):
    """Settings supplied exclusively by the process environment."""

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=_ENV_FILE,
        env_ignore_empty=True,
        extra="ignore",
        populate_by_name=True,
    )

    environment: Literal["development", "test", "production"] = Field(alias="ENVIRONMENT")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(alias="LOG_LEVEL")
    database_url: str = Field(alias="DATABASE_URL")
    migration_database_url: str = Field(alias="MIGRATION_DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")
    cors_allowed_origins: list[AnyUrl] = Field(alias="CORS_ALLOWED_ORIGINS")
    auth_provider: str = Field(default="clerk", alias="AUTH_PROVIDER")
    clerk_issuer: str | None = Field(default=None, alias="CLERK_ISSUER")
    clerk_jwks_url: AnyUrl | None = Field(default=None, alias="CLERK_JWKS_URL")
    clerk_audience: str | None = Field(default=None, alias="CLERK_AUDIENCE")
    clerk_authorized_parties: list[str] | None = Field(
        default=None, alias="CLERK_AUTHORIZED_PARTIES"
    )
    cursor_signing_keys: Annotated[list[str], NoDecode] = Field(
        alias="CURSOR_SIGNING_KEYS", repr=False
    )
    sentry_dsn: str | None = Field(default=None, alias="SENTRY_DSN")
    otlp_endpoint: str | None = Field(default=None, alias="OTLP_ENDPOINT")

    @model_validator(mode="after")
    def validate_clerk_settings(self) -> Settings:
        if self.auth_provider == "clerk":
            if not self.clerk_issuer:
                raise ValueError("CLERK_ISSUER is required when AUTH_PROVIDER=clerk")
            if not self.clerk_authorized_parties:
                raise ValueError("CLERK_AUTHORIZED_PARTIES is required when AUTH_PROVIDER=clerk")
        return self

    @field_validator("cursor_signing_keys", mode="before")
    @classmethod
    def validate_cursor_signing_keys(cls, value: object) -> list[str]:
        if value is None:
            raise ValueError("CURSOR_SIGNING_KEYS is required")
        if isinstance(value, str):
            items = [part.strip() for part in value.split(",") if part.strip()]
        elif isinstance(value, list):
            items = [str(part).strip() for part in value if str(part).strip()]
        else:
            raise ValueError("CURSOR_SIGNING_KEYS must be a comma-separated list of strings")
        if not items:
            raise ValueError("CURSOR_SIGNING_KEYS is required")
        for key in items:
            if len(key.encode("utf-8")) < 32:
                raise ValueError("each CURSOR_SIGNING_KEYS value must be at least 32 bytes")
        return items

    @field_validator("database_url", "migration_database_url", mode="before")
    @classmethod
    def normalize_database_urls(cls, value: str) -> str:
        return _normalize_postgres_url(value)

    @field_validator("database_url", "migration_database_url")
    @classmethod
    def validate_postgres_url(cls, value: str) -> str:
        return _check_postgres_url(value)

    @field_validator("redis_url")
    @classmethod
    def validate_redis_url(cls, value: str) -> str:
        return _check_redis_url(value)

    @field_validator("cors_allowed_origins")
    @classmethod
    def reject_wildcard_cors(cls, values: list[AnyUrl]) -> list[AnyUrl]:
        if not values:
            msg = "must contain at least one explicit origin"
            raise ValueError(msg)
        if any("*" in str(value) for value in values):
            msg = "must not contain a wildcard origin"
            raise ValueError(msg)
        return values

    @property
    def cors_origins(self) -> list[str]:
        """Return normalized strings accepted by Starlette's CORS middleware."""
        return [str(origin).rstrip("/") for origin in self.cors_allowed_origins]

    @property
    def cursor_signing_key_bytes(self) -> list[bytes]:
        """Return the active cursor-signing keys as raw bytes for HMAC verification."""
        return [key.encode("utf-8") for key in self.cursor_signing_keys]
