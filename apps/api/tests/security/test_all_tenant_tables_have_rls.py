"""Schema-wide guardrail for tenant-table RLS configuration."""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine
from tests.security.conftest import RLS_TABLE_EXCEPTIONS, assert_tenant_tables_have_rls


async def test_all_tenant_tables_have_forced_rls_and_policy(
    tenant_probe: None,
    migrator_engine: AsyncEngine,
) -> None:
    assert RLS_TABLE_EXCEPTIONS == frozenset({"users"})
    await assert_tenant_tables_have_rls(migrator_engine)


async def test_guardrail_detects_unprotected_scratch_table(
    tenant_probe: None,
    migrator_engine: AsyncEngine,
) -> None:
    async with migrator_engine.begin() as connection:
        await connection.execute(
            text("CREATE TABLE tenant_probe_unprotected_scratch (id uuid, user_id uuid)")
        )
    try:
        with pytest.raises(AssertionError, match="tenant_probe_unprotected_scratch") as failure:
            await assert_tenant_tables_have_rls(migrator_engine)
        assert "Tenant tables without forced tenant_isolation RLS" in str(failure.value)
        assert "tenant_probe_unprotected_scratch" in str(failure.value)
    finally:
        async with migrator_engine.begin() as connection:
            await connection.execute(text("DROP TABLE tenant_probe_unprotected_scratch"))


async def test_guardrail_detects_users_without_forced_rls(
    tenant_probe: None,
    migrator_engine: AsyncEngine,
) -> None:
    async with migrator_engine.begin() as connection:
        await connection.execute(text("ALTER TABLE users NO FORCE ROW LEVEL SECURITY"))
    try:
        with pytest.raises(AssertionError, match="users"):
            await assert_tenant_tables_have_rls(migrator_engine)
    finally:
        async with migrator_engine.begin() as connection:
            await connection.execute(text("ALTER TABLE users FORCE ROW LEVEL SECURITY"))
