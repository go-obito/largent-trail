"""Provision the least-privilege PostgreSQL roles before applying migrations.

Run this only as an explicit deployment/bootstrap step using a privileged
DATABASE_BOOTSTRAP_URL. The normal API and Alembic URLs must use their own
restricted roles.
"""

from __future__ import annotations

import asyncio
import os

from sqlalchemy import text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine

_ROLE_APP = "largent_app"
_ROLE_MIGRATOR = "largent_migrator"


def _required_url(variable: str) -> URL:
    raw = os.environ.get(variable, "").strip()
    if not raw:
        raise RuntimeError(f"{variable} is required for database role bootstrap")

    try:
        url = make_url(raw)
    except Exception as exc:
        raise RuntimeError(f"{variable} is not a valid PostgreSQL URL") from exc

    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+asyncpg")
    if url.drivername != "postgresql+asyncpg":
        raise RuntimeError(f"{variable} must be a PostgreSQL URL")
    if not url.host or not url.database:
        raise RuntimeError(f"{variable} must include a host and database")
    return url


def _require_role_url(variable: str, expected_role: str) -> URL:
    url = _required_url(variable)
    if url.username != expected_role:
        raise RuntimeError(f"{variable} must connect as {expected_role}")
    if not url.password:
        raise RuntimeError(f"{variable} must include the password for {expected_role}")
    return url


async def _ensure_role(
    connection: AsyncConnection, role_name: str, password: str
) -> None:
    """Create or normalize one fixed-name role without granting elevated privileges."""
    password_literal = await connection.scalar(
        text("SELECT quote_literal(:password)"), {"password": password}
    )
    if not isinstance(password_literal, str):
        raise RuntimeError("PostgreSQL could not safely quote a role password")

    exists = await connection.scalar(
        text("SELECT 1 FROM pg_roles WHERE rolname = :role_name"),
        {"role_name": role_name},
    )
    action = "ALTER ROLE" if exists else "CREATE ROLE"
    await connection.exec_driver_sql(
        f"{action} {role_name} WITH LOGIN PASSWORD {password_literal} "
        "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS"
    )


async def bootstrap_database_roles() -> None:
    """Provision app/migrator roles and the schema privileges expected by migrations."""
    admin_url = _required_url("DATABASE_BOOTSTRAP_URL")
    app_url = _require_role_url("DATABASE_URL", _ROLE_APP)
    migrator_url = _require_role_url("MIGRATION_DATABASE_URL", _ROLE_MIGRATOR)

    if not (
        admin_url.database == app_url.database == migrator_url.database
    ):
        raise RuntimeError(
            "DATABASE_BOOTSTRAP_URL, DATABASE_URL, and MIGRATION_DATABASE_URL "
            "must target the same database"
        )

    engine = create_async_engine(admin_url, pool_pre_ping=True)
    try:
        async with engine.begin() as connection:
            privileges = (
                await connection.execute(
                    text(
                        "SELECT rolsuper, rolcreaterole "
                        "FROM pg_roles WHERE rolname = current_user"
                    )
                )
            ).one_or_none()
            if privileges is None or not (privileges.rolsuper or privileges.rolcreaterole):
                raise RuntimeError(
                    "DATABASE_BOOTSTRAP_URL must use a PostgreSQL role with "
                    "CREATEROLE or superuser privileges"
                )

            await _ensure_role(connection, _ROLE_MIGRATOR, migrator_url.password or "")
            await _ensure_role(connection, _ROLE_APP, app_url.password or "")

            database_name = await connection.scalar(
                text("SELECT quote_ident(current_database())")
            )
            if not isinstance(database_name, str):
                raise RuntimeError("Could not identify the target PostgreSQL database")

            await connection.exec_driver_sql(
                f"GRANT CONNECT ON DATABASE {database_name} "
                f"TO {_ROLE_APP}, {_ROLE_MIGRATOR}"
            )
            await connection.exec_driver_sql("REVOKE CREATE ON SCHEMA public FROM PUBLIC")
            await connection.exec_driver_sql(
                f"GRANT USAGE, CREATE ON SCHEMA public TO {_ROLE_MIGRATOR}"
            )
            await connection.exec_driver_sql(
                f"GRANT USAGE ON SCHEMA public TO {_ROLE_APP}"
            )
            await connection.exec_driver_sql(
                "ALTER DEFAULT PRIVILEGES FOR ROLE largent_migrator IN SCHEMA public "
                "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO largent_app"
            )
            await connection.exec_driver_sql(
                "ALTER DEFAULT PRIVILEGES FOR ROLE largent_migrator IN SCHEMA public "
                "GRANT USAGE, SELECT ON SEQUENCES TO largent_app"
            )
    finally:
        await engine.dispose()


def main() -> None:
    asyncio.run(bootstrap_database_roles())
    print("PostgreSQL application and migration roles are ready.")


if __name__ == "__main__":
    main()
