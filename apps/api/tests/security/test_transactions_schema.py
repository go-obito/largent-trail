"""Schema-level guarantees of the transactions table, checked against real Postgres."""

from __future__ import annotations

import asyncio
import os
import secrets
import subprocess
import sys
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import date
from uuid import UUID

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from tests.security.conftest import (
    API_DIRECTORY,
    TenantDatabaseURLs,
    TenantSessionFactory,
)

from largent.core.ids import new_uuid7
from largent.core.tenancy import SessionFactory, system_session

B3_REVISION = "0004_users_defaults_seeded_at"
OCCURRED_ON = date(2025, 1, 15)


async def _insert_account(session: AsyncSession, user_id: UUID) -> UUID:
    account_id = new_uuid7()
    await session.execute(
        text("INSERT INTO accounts (id, user_id, name, type) VALUES (:id, :u, :n, 'cash')"),
        {"id": account_id, "u": user_id, "n": f"Account {account_id}"},
    )
    return account_id


async def _insert_category(session: AsyncSession, user_id: UUID, kind: str = "expense") -> UUID:
    category_id = new_uuid7()
    await session.execute(
        text(
            "INSERT INTO categories (id, user_id, kind, name) "
            "VALUES (:id, :u, CAST(:k AS category_kind), :n)"
        ),
        {"id": category_id, "u": user_id, "k": kind, "n": f"Category {category_id}"},
    )
    return category_id


async def _insert_transaction(
    session: AsyncSession,
    user_id: UUID,
    account_id: UUID,
    category_id: UUID | None,
    *,
    kind: str = "expense",
    amount_minor: int = 1_300,
) -> None:
    await session.execute(
        text(
            "INSERT INTO transactions "
            "(id, user_id, account_id, category_id, kind, amount_minor, occurred_on) "
            "VALUES (:id, :u, :a, :c, CAST(:k AS category_kind), :amt, :d)"
        ),
        {
            "id": new_uuid7(),
            "u": user_id,
            "a": account_id,
            "c": category_id,
            "k": kind,
            "amt": amount_minor,
            "d": OCCURRED_ON,
        },
    )


async def test_transactions_table_has_forced_rls_and_the_composite_fk_targets(
    tenant_database: TenantDatabaseURLs,
) -> None:
    engine = create_async_engine(tenant_database.admin)
    try:
        async with engine.connect() as connection:
            flags = (
                await connection.execute(
                    text(
                        "SELECT relrowsecurity, relforcerowsecurity FROM pg_class "
                        "WHERE relname = 'transactions' AND relkind = 'r'"
                    )
                )
            ).one()
            constraints: set[str] = set(
                (
                    await connection.execute(
                        text(
                            "SELECT conname FROM pg_constraint "
                            "WHERE contype = 'u' AND conrelid IN "
                            "('transactions'::regclass, 'categories'::regclass)"
                        )
                    )
                ).scalars()
            )
            policy: int = (
                await connection.execute(
                    text(
                        "SELECT count(*) FROM pg_policy "
                        "WHERE polrelid = 'transactions'::regclass AND polname = 'tenant_isolation'"
                    )
                )
            ).scalar_one()
            match_types: set[str] = set(
                (
                    await connection.execute(
                        text(
                            "SELECT confmatchtype::text FROM pg_constraint "
                            "WHERE contype = 'f' AND conrelid = 'transactions'::regclass "
                            "AND confrelid = 'categories'::regclass"
                        )
                    )
                ).scalars()
            )
    finally:
        await engine.dispose()

    assert tuple(flags) == (True, True)
    assert policy == 1
    assert {"uq_transactions_user_id_id", "uq_categories_user_id_id_kind"} <= constraints
    assert match_types == {"s"}


async def test_the_app_role_sees_no_rows_without_a_tenant_setting(
    seeded_tenants: None,
    as_tenant: TenantSessionFactory,
    app_session_factory: SessionFactory,
    tenant_a: UUID,
) -> None:
    async with as_tenant(tenant_a) as session:
        account_id = await _insert_account(session, tenant_a)
        await _insert_transaction(session, tenant_a, account_id, None)

    async with system_session(app_session_factory) as session:
        count: int = (await session.execute(text("SELECT count(*) FROM transactions"))).scalar_one()
        rows = (await session.execute(text("SELECT * FROM transactions"))).all()

    assert count == 0
    assert rows == []


async def test_a_matching_kind_and_an_uncategorized_transaction_are_accepted(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    async with as_tenant(tenant_a) as session:
        account_id = await _insert_account(session, tenant_a)
        expense = await _insert_category(session, tenant_a, "expense")
        income = await _insert_category(session, tenant_a, "income")
        await _insert_transaction(session, tenant_a, account_id, expense, kind="expense")
        await _insert_transaction(session, tenant_a, account_id, income, kind="income")
        await _insert_transaction(session, tenant_a, account_id, None, kind="income")

        total: int = (await session.execute(text("SELECT count(*) FROM transactions"))).scalar_one()

    assert total == 3


@pytest.mark.parametrize(
    ("category_kind", "transaction_kind"), [("expense", "income"), ("income", "expense")]
)
async def test_the_database_rejects_a_category_kind_mismatch(
    seeded_tenants: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
    category_kind: str,
    transaction_kind: str,
) -> None:
    with pytest.raises(IntegrityError, match="fk_transactions_user_id_category_id_kind"):
        async with as_tenant(tenant_a) as session:
            account_id = await _insert_account(session, tenant_a)
            category_id = await _insert_category(session, tenant_a, category_kind)
            await _insert_transaction(
                session, tenant_a, account_id, category_id, kind=transaction_kind
            )


async def test_the_database_rejects_changing_the_kind_of_a_referenced_category(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    async with as_tenant(tenant_a) as session:
        account_id = await _insert_account(session, tenant_a)
        category_id = await _insert_category(session, tenant_a, "expense")
        await _insert_transaction(session, tenant_a, account_id, category_id)

    with pytest.raises(IntegrityError, match="fk_transactions_user_id_category_id_kind"):
        async with as_tenant(tenant_a) as session:
            await session.execute(
                text("UPDATE categories SET kind = 'income' WHERE id = :id"), {"id": category_id}
            )


async def test_the_database_rejects_another_tenants_account(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    async with as_tenant(tenant_b) as session:
        foreign_account = await _insert_account(session, tenant_b)

    with pytest.raises(IntegrityError, match="fk_transactions_user_id_account_id_accounts"):
        async with as_tenant(tenant_a) as session:
            await _insert_transaction(session, tenant_a, foreign_account, None)


async def test_the_database_rejects_another_tenants_category(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID, tenant_b: UUID
) -> None:
    async with as_tenant(tenant_b) as session:
        foreign_category = await _insert_category(session, tenant_b, "expense")
    async with as_tenant(tenant_a) as session:
        own_account = await _insert_account(session, tenant_a)

    with pytest.raises(IntegrityError, match="fk_transactions_user_id_category_id_kind"):
        async with as_tenant(tenant_a) as session:
            await _insert_transaction(session, tenant_a, own_account, foreign_category)


@pytest.mark.parametrize("amount_minor", [0, -1, 10**12 + 1])
async def test_the_database_rejects_out_of_range_amounts(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID, amount_minor: int
) -> None:
    with pytest.raises(IntegrityError, match="ck_transactions_amount_range"):
        async with as_tenant(tenant_a) as session:
            account_id = await _insert_account(session, tenant_a)
            await _insert_transaction(
                session, tenant_a, account_id, None, amount_minor=amount_minor
            )


async def test_the_database_accepts_the_amount_bounds(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    async with as_tenant(tenant_a) as session:
        account_id = await _insert_account(session, tenant_a)
        await _insert_transaction(session, tenant_a, account_id, None, amount_minor=1)
        await _insert_transaction(session, tenant_a, account_id, None, amount_minor=10**12)


async def test_the_database_rejects_other_currencies_and_long_notes(
    seeded_tenants: None, as_tenant: TenantSessionFactory, tenant_a: UUID
) -> None:
    async with as_tenant(tenant_a) as session:
        account_id = await _insert_account(session, tenant_a)

    for currency, note, constraint in (
        ("USD", None, "ck_transactions_currency_ghs_only"),
        (None, "n" * 281, "ck_transactions_note_length"),
        (None, "", "ck_transactions_note_length"),
    ):
        with pytest.raises(IntegrityError, match=constraint):
            async with as_tenant(tenant_a) as session:
                await session.execute(
                    text(
                        "INSERT INTO transactions (id, user_id, account_id, kind, amount_minor, "
                        "occurred_on, currency, note) VALUES (:id, :u, :a, 'expense', 100, :d, "
                        "COALESCE(CAST(:currency AS text), 'GHS'), CAST(:note AS text))"
                    ),
                    {
                        "id": new_uuid7(),
                        "u": tenant_a,
                        "a": account_id,
                        "d": OCCURRED_ON,
                        "currency": currency,
                        "note": note,
                    },
                )


@dataclass(frozen=True)
class MigrationTarget:
    migrator_url: str
    environment: dict[str, str]


@pytest_asyncio.fixture
async def b3_database(tenant_database: TenantDatabaseURLs) -> AsyncIterator[MigrationTarget]:
    """An empty database prepared like the real one, plus the env for running Alembic on it."""
    name = "b3_migration"
    admin_url = make_url(tenant_database.admin)
    admin = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin.connect() as connection:
        await connection.execute(text(f"CREATE DATABASE {name}"))
    scoped = create_async_engine(admin_url.set(database=name))
    async with scoped.begin() as connection:
        await connection.execute(text("REVOKE CREATE ON SCHEMA public FROM PUBLIC"))
        await connection.execute(text("ALTER SCHEMA public OWNER TO largent_migrator"))
        await connection.execute(text("GRANT USAGE ON SCHEMA public TO largent_app"))
        await connection.execute(
            text(
                "ALTER DEFAULT PRIVILEGES FOR ROLE largent_migrator IN SCHEMA public "
                "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO largent_app"
            )
        )
    await scoped.dispose()
    app_url = make_url(tenant_database.app).set(database=name).render_as_string(False)
    migrator_url = make_url(tenant_database.migrator).set(database=name).render_as_string(False)
    environment = os.environ.copy()
    environment.update(
        {
            "ENVIRONMENT": "test",
            "LOG_LEVEL": "INFO",
            "DATABASE_URL": app_url,
            "MIGRATION_DATABASE_URL": migrator_url,
            "REDIS_URL": "redis://127.0.0.1:6379/0",
            "CORS_ALLOWED_ORIGINS": '["http://localhost:3000"]',
            "AUTH_PROVIDER": "clerk",
            "CLERK_ISSUER": "https://clerk.test",
            "CLERK_AUDIENCE": "largent-api",
            "CLERK_AUTHORIZED_PARTIES": '["http://localhost:3000"]',
            "CURSOR_SIGNING_KEYS": secrets.token_urlsafe(48),
        }
    )
    try:
        yield MigrationTarget(migrator_url, environment)
    finally:
        async with admin.connect() as connection:
            await connection.execute(text(f"DROP DATABASE IF EXISTS {name} WITH (FORCE)"))
        await admin.dispose()


async def _alembic(target: MigrationTarget, *arguments: str) -> None:
    result = await asyncio.to_thread(
        subprocess.run,
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", *arguments],
        cwd=API_DIRECTORY,
        env=target.environment,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, f"alembic {arguments} failed:\n{result.stdout}\n{result.stderr}"


async def _transactions_state(target: MigrationTarget) -> tuple[bool, bool]:
    engine = create_async_engine(target.migrator_url)
    try:
        async with engine.connect() as connection:
            table = await connection.scalar(text("SELECT to_regclass('public.transactions')"))
            constraint = await connection.scalar(
                text("SELECT 1 FROM pg_constraint WHERE conname = 'uq_categories_user_id_id_kind'")
            )
    finally:
        await engine.dispose()
    return table is not None, constraint is not None


async def test_migration_from_the_b3_revision_goes_up_down_and_up(
    b3_database: MigrationTarget,
) -> None:
    await _alembic(b3_database, "upgrade", B3_REVISION)
    assert await _transactions_state(b3_database) == (False, False)

    engine = create_async_engine(b3_database.migrator_url)
    try:
        async with engine.begin() as connection:
            user_id = new_uuid7()
            await connection.execute(
                text("INSERT INTO users (id, auth_provider, auth_subject) VALUES (:id, 't', 'x')"),
                {"id": user_id},
            )
            await connection.execute(
                text("SELECT set_config('app.user_id', :u, true)"), {"u": str(user_id)}
            )
            await connection.execute(
                text(
                    "INSERT INTO categories (id, user_id, kind, name) "
                    "VALUES (:id, :u, 'expense', 'Food')"
                ),
                {"id": new_uuid7(), "u": user_id},
            )
    finally:
        await engine.dispose()

    await _alembic(b3_database, "upgrade", "head")
    assert await _transactions_state(b3_database) == (True, True)
    await _alembic(b3_database, "downgrade", "-1")
    assert await _transactions_state(b3_database) == (False, False)
    await _alembic(b3_database, "upgrade", "head")
    assert await _transactions_state(b3_database) == (True, True)
