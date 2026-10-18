"""Tenant RLS behavior against a real PostgreSQL instance."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from tests.conftest import make_settings
from tests.fake_auth import FakeAuthProvider
from tests.security.conftest import (
    TenantDatabaseURLs,
    TenantSessionFactory,
    assert_tenant_isolated,
)

from largent.core.security import VerifiedIdentity
from largent.core.tenancy import (
    SessionFactory,
    get_current_user_id,
    get_tenant_session,
    system_session,
    tenant_session,
)
from largent.main import create_app

router = APIRouter()


class ProbeInput(BaseModel):
    value: str = Field(max_length=100)


@router.get("/test/tenant-probe/{row_id}")
async def read_probe(
    row_id: UUID,
    session: Annotated[AsyncSession, Depends(get_tenant_session)],
) -> dict[str, str]:
    result = await session.execute(
        text("SELECT value FROM tenant_probe WHERE id = :id"), {"id": row_id}
    )
    value: object | None = result.scalar_one_or_none()
    if not isinstance(value, str):
        raise HTTPException(status_code=404, detail="Probe row not found.")
    return {"value": value}


@router.post("/test/tenant-probe", status_code=201)
async def create_probe(
    payload: ProbeInput,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_session)],
) -> dict[str, str]:
    row_id = uuid4()
    await session.execute(
        text("INSERT INTO tenant_probe (id, user_id, value) VALUES (:id, :user_id, :value)"),
        {"id": row_id, "user_id": user_id, "value": payload.value},
    )
    return {"id": str(row_id), "value": payload.value}


@router.patch("/test/tenant-probe/{row_id}")
async def update_probe(
    row_id: UUID,
    payload: ProbeInput,
    session: Annotated[AsyncSession, Depends(get_tenant_session)],
) -> dict[str, str]:
    result = await session.execute(
        text("UPDATE tenant_probe SET value = :value WHERE id = :id RETURNING value"),
        {"id": row_id, "value": payload.value},
    )
    value: object | None = result.scalar_one_or_none()
    if not isinstance(value, str):
        raise HTTPException(status_code=404, detail="Probe row not found.")
    return {"value": value}


@router.delete("/test/tenant-probe/{row_id}", status_code=204)
async def delete_probe(
    row_id: UUID,
    session: Annotated[AsyncSession, Depends(get_tenant_session)],
) -> None:
    await session.execute(text("DELETE FROM tenant_probe WHERE id = :id"), {"id": row_id})


async def insert_probe(as_tenant: TenantSessionFactory, user_id: UUID, value: str) -> UUID:
    row_id = uuid4()
    async with as_tenant(user_id) as session:
        await session.execute(
            text("INSERT INTO tenant_probe (id, user_id, value) VALUES (:id, :user_id, :value)"),
            {"id": row_id, "user_id": user_id, "value": value},
        )
    return row_id


async def test_each_tenant_sees_only_its_rows(
    tenant_probe: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    await insert_probe(as_tenant, tenant_a, "a-value")
    await insert_probe(as_tenant, tenant_b, "b-value")

    async def load_values(session: AsyncSession) -> list[str]:
        result = await session.execute(text("SELECT value FROM tenant_probe ORDER BY value"))
        values: list[object] = list(result.scalars().all())
        return [str(item) for item in values]

    await assert_tenant_isolated(
        as_tenant, load_values, tenant_a, tenant_b, ["a-value"], ["b-value"]
    )


async def test_tenant_cannot_insert_for_another_tenant(
    tenant_probe: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    with pytest.raises(DBAPIError):
        async with as_tenant(tenant_b) as session:
            await session.execute(
                text(
                    "INSERT INTO tenant_probe (id, user_id, value) VALUES (:id, :user_id, :value)"
                ),
                {"id": uuid4(), "user_id": tenant_a, "value": "forged"},
            )


async def test_tenant_update_and_delete_of_other_rows_affect_zero(
    tenant_probe: None,
    as_tenant: TenantSessionFactory,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    row_id = await insert_probe(as_tenant, tenant_a, "owned-by-a")
    async with as_tenant(tenant_b) as session:
        update = await session.execute(
            text("UPDATE tenant_probe SET value = 'changed' WHERE id = :id RETURNING id"),
            {"id": row_id},
        )
        delete = await session.execute(
            text("DELETE FROM tenant_probe WHERE id = :id RETURNING id"), {"id": row_id}
        )
    assert update.scalar_one_or_none() is None
    assert delete.scalar_one_or_none() is None


async def test_missing_and_empty_tenant_settings_fail_closed(
    tenant_probe: None,
    app_session_factory: SessionFactory,
) -> None:
    async with system_session(app_session_factory) as session:
        result = await session.execute(text("SELECT count(*) FROM tenant_probe"))
        assert result.scalar_one() == 0
        with pytest.raises(DBAPIError):
            await session.execute(
                text("INSERT INTO tenant_probe (id, user_id, value) VALUES (:id, :id, 'missing')"),
                {"id": uuid4()},
            )

    async with system_session(app_session_factory) as session:
        await session.execute(text("SELECT set_config('app.user_id', '', true)"))
        result = await session.execute(text("SELECT count(*) FROM tenant_probe"))
        assert result.scalar_one() == 0
        with pytest.raises(DBAPIError):
            await session.execute(
                text("INSERT INTO tenant_probe (id, user_id, value) VALUES (:id, :id, 'empty')"),
                {"id": uuid4()},
            )


async def test_pool_reuse_does_not_leak_tenant_context(
    tenant_probe: None,
    tenant_database: TenantDatabaseURLs,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    engine = create_async_engine(tenant_database.app, pool_size=1, max_overflow=0)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with tenant_session(tenant_a, session_factory) as session:
            await session.execute(
                text("INSERT INTO tenant_probe (id, user_id, value) VALUES (:id, :user_id, 'a')"),
                {"id": uuid4(), "user_id": tenant_a},
            )
            tenant_pid = int(await session.scalar(text("SELECT pg_backend_pid()")))
        async with system_session(session_factory) as session:
            system_pid = int(await session.scalar(text("SELECT pg_backend_pid()")))
            result = await session.execute(text("SELECT count(*) FROM tenant_probe"))
            assert result.scalar_one() == 0
        assert tenant_pid == system_pid
    finally:
        await engine.dispose()


async def test_set_config_is_transaction_local(
    tenant_probe: None,
    app_session_factory: SessionFactory,
    tenant_a: UUID,
) -> None:
    async with tenant_session(tenant_a, app_session_factory) as session:
        current_user_id = await session.scalar(text("SELECT current_setting('app.user_id', true)"))
        assert current_user_id == str(tenant_a)
    async with system_session(app_session_factory) as session:
        current_user_id = await session.scalar(
            text("SELECT nullif(current_setting('app.user_id', true), '')")
        )
        assert current_user_id is None


async def test_app_role_cannot_change_rls_or_drop_table(
    tenant_probe: None,
    app_engine: AsyncEngine,
) -> None:
    async with app_engine.connect() as connection:
        role_flags = (
            await connection.execute(
                text("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
            )
        ).one()
    assert role_flags == (False, False)

    statements = (
        "ALTER TABLE tenant_probe DISABLE ROW LEVEL SECURITY",
        "ALTER POLICY tenant_isolation ON tenant_probe USING (true)",
        "DROP POLICY tenant_isolation ON tenant_probe",
        "DROP TABLE tenant_probe",
    )
    for statement in statements:
        with pytest.raises(DBAPIError):
            async with app_engine.begin() as connection:
                await connection.execute(text(statement))


async def test_migrator_owner_is_subject_to_forced_rls(
    tenant_probe: None,
    migrator_engine: AsyncEngine,
) -> None:
    session_factory = async_sessionmaker(migrator_engine, expire_on_commit=False)
    async with system_session(session_factory) as session:
        result = await session.execute(text("SELECT count(*) FROM tenant_probe"))
        assert result.scalar_one() == 0
        with pytest.raises(DBAPIError):
            await session.execute(
                text("INSERT INTO tenant_probe (id, user_id, value) VALUES (:id, :id, 'owner')"),
                {"id": uuid4()},
            )


async def test_http_routes_are_tenant_scoped_and_default_to_unauthenticated_problem(
    tenant_probe: None,
    app_engine: AsyncEngine,
    tenant_database: TenantDatabaseURLs,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    owner_factory = async_sessionmaker(app_engine, expire_on_commit=False)
    row_id = await insert_probe(
        lambda user_id: tenant_session(user_id, owner_factory), tenant_b, "b"
    )
    app = create_app(
        make_settings(
            database_url=tenant_database.app,
            migration_database_url=tenant_database.migrator,
        )
    )
    app.state.session_factory = owner_factory
    app.include_router(router)
    await app.state.auth_provider.aclose()
    app.state.auth_provider = FakeAuthProvider(
        {
            "tenant-a-token": VerifiedIdentity("test", "tenant-a"),
            "tenant-b-token": VerifiedIdentity("test", "tenant-b"),
        }
    )
    active_identity_key = "tenant-a-token"

    def auth_headers() -> dict[str, str]:
        return {"Authorization": f"Bearer {active_identity_key}"}

    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            read_response = await client.get(f"/test/tenant-probe/{row_id}", headers=auth_headers())
            update_response = await client.patch(
                f"/test/tenant-probe/{row_id}",
                json={"value": "changed"},
                headers=auth_headers(),
            )
            delete_response = await client.delete(
                f"/test/tenant-probe/{row_id}", headers=auth_headers()
            )
            assert read_response.status_code == 404
            assert update_response.status_code == 404
            assert delete_response.status_code == 204

            create_response = await client.post(
                "/test/tenant-probe", json={"value": "created-by-a"}, headers=auth_headers()
            )
            assert create_response.status_code == 201
            created_id = UUID(create_response.json()["id"])

            active_identity_key = "tenant-b-token"
            owner_response = await client.get(
                f"/test/tenant-probe/{row_id}", headers=auth_headers()
            )
            assert owner_response.status_code == 200
            assert owner_response.json() == {"value": "b"}

            own_row_response = await client.get(
                f"/test/tenant-probe/{created_id}", headers=auth_headers()
            )
            assert own_row_response.status_code == 404

            active_identity_key = "tenant-a-token"
            own_row_response = await client.get(
                f"/test/tenant-probe/{created_id}", headers=auth_headers()
            )
            assert own_row_response.status_code == 200
            assert own_row_response.json() == {"value": "created-by-a"}

            unauthenticated = await client.get(f"/test/tenant-probe/{row_id}")
            assert unauthenticated.status_code == 401
            assert unauthenticated.headers["content-type"] == "application/problem+json"
            assert unauthenticated.json()["code"] == "unauthenticated"
    finally:
        await app.state.auth_provider.aclose()
        await app.state.redis.aclose()
        await app.state.engine.dispose()
