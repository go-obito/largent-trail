"""Shared test configuration."""

from __future__ import annotations

from largent.core.config import Settings


def make_settings(**overrides: object) -> Settings:
    """Create self-contained test settings without consulting a local .env file."""
    values: dict[str, object] = {
        "environment": "test",
        "log_level": "INFO",
        "database_url": "postgresql+asyncpg://app:password@127.0.0.1:5432/largent",
        "migration_database_url": "postgresql+asyncpg://migrator:password@127.0.0.1:5432/largent",
        "redis_url": "redis://127.0.0.1:6379/0",
        "cors_allowed_origins": ["http://localhost:3000"],
        "auth_provider": "clerk",
        "clerk_issuer": "https://clerk.test",
        "clerk_audience": "largent-api",
        "clerk_authorized_parties": ["http://localhost:3000"],
    }
    values.update(overrides)
    return Settings.model_validate(values)
