"""End-to-end auth, provisioning, profile, and users-table RLS tests."""

from __future__ import annotations

import asyncio
import json
import time
from uuid import UUID

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import Encoding, NoEncryption, PrivateFormat
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker
from tests.conftest import make_settings
from tests.security.conftest import TenantDatabaseURLs

from largent.core.security import ClerkAuthProvider, VerifiedIdentity
from largent.core.tenancy import SessionFactory, system_session, tenant_session
from largent.main import create_app
from largent.modules.users.service import get_or_provision_user_id

ISSUER = "https://clerk.test"
AUDIENCE = "largent-api"
AUTHORIZED_PARTY = "http://localhost:3000"


def _test_key() -> tuple[rsa.RSAPrivateKey, dict[str, object]]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    public_jwk.update({"kid": "test-key", "use": "sig", "alg": "RS256"})
    return private_key, public_jwk


def _token(
    private_key: rsa.RSAPrivateKey,
    subject: str,
    *,
    email: str | None = None,
    display_name: str | None = None,
) -> str:
    now = int(time.time())
    claims: dict[str, object] = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "azp": AUTHORIZED_PARTY,
        "sub": subject,
        "iat": now,
        "nbf": now - 1,
        "exp": now + 300,
    }
    if email is not None:
        claims["email"] = email
    if display_name is not None:
        claims["display_name"] = display_name
    pem = private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    return jwt.encode(claims, pem, algorithm="RS256", headers={"kid": "test-key"})


def _auth_provider(jwk: dict[str, object]) -> tuple[ClerkAuthProvider, httpx.AsyncClient]:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"keys": [jwk]}))
    )
    provider = ClerkAuthProvider(
        issuer=ISSUER,
        audience=AUDIENCE,
        authorized_parties=[AUTHORIZED_PARTY],
        client=client,
    )
    return provider, client


async def _make_client(
    database_urls: TenantDatabaseURLs,
    provider: ClerkAuthProvider,
) -> tuple[httpx.AsyncClient, object]:
    app = create_app(
        make_settings(
            database_url=database_urls.app,
            migration_database_url=database_urls.migrator,
        )
    )
    await app.state.auth_provider.aclose()
    app.state.auth_provider = provider
    return (
        httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test"),
        app,
    )


async def test_first_request_provisions_once_and_second_reuses_user(
    tenant_database: TenantDatabaseURLs,
    app_session_factory: SessionFactory,
    migrator_engine: AsyncEngine,
    capsys: pytest.CaptureFixture[str],
) -> None:
    private_key, jwk = _test_key()
    provider, auth_client = _auth_provider(jwk)
    client, _ = await _make_client(tenant_database, provider)
    display_name = "Private Display Name"
    token = _token(
        private_key,
        "auth-first-sight",
        email="private.email@example.com",
        display_name=display_name,
    )
    try:
        first = await client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
        second = await client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
        assert first.status_code == second.status_code == 200
        assert first.json()["id"] == second.json()["id"]
        assert UUID(first.json()["id"]).version == 7
        assert first.json()["email"] == "private.email@example.com"
        migrator_factory = async_sessionmaker(migrator_engine, expire_on_commit=False)
        async with system_session(migrator_factory) as session:
            count = await session.scalar(
                text("SELECT count(*) FROM users WHERE auth_subject = :subject"),
                {"subject": "auth-first-sight"},
            )
        assert count == 1
        captured = capsys.readouterr().out
        assert token not in captured
        assert "private.email@example.com" not in captured
        assert display_name not in captured
    finally:
        await client.aclose()
        await auth_client.aclose()


async def test_concurrent_first_requests_return_the_same_user(
    tenant_database: TenantDatabaseURLs,
    migrator_engine: AsyncEngine,
) -> None:
    private_key, jwk = _test_key()
    provider, auth_client = _auth_provider(jwk)
    client, _ = await _make_client(tenant_database, provider)
    token = _token(private_key, "concurrent-first-sight")
    try:
        responses = await asyncio.gather(
            *[client.get("/v1/me", headers={"Authorization": f"Bearer {token}"}) for _ in range(8)]
        )
        assert all(response.status_code == 200 for response in responses)
        assert len({response.json()["id"] for response in responses}) == 1
    finally:
        await client.aclose()
        await auth_client.aclose()
    migrator_factory = async_sessionmaker(migrator_engine, expire_on_commit=False)
    async with system_session(migrator_factory) as session:
        count = await session.scalar(
            text("SELECT count(*) FROM users WHERE auth_subject = :subject"),
            {"subject": "concurrent-first-sight"},
        )
    assert count == 1


async def test_bearer_errors_have_stable_codes_and_no_cookie_auth(
    tenant_database: TenantDatabaseURLs,
) -> None:
    private_key, jwk = _test_key()
    provider, auth_client = _auth_provider(jwk)
    client, _ = await _make_client(tenant_database, provider)
    now = int(time.time())
    pem = private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    expired = jwt.encode(
        {
            "iss": ISSUER,
            "aud": AUDIENCE,
            "azp": AUTHORIZED_PARTY,
            "sub": "expired-user",
            "iat": now - 60,
            "nbf": now - 60,
            "exp": now - 30,
        },
        pem,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )
    try:
        missing = await client.get("/v1/me")
        malformed = await client.get("/v1/me", headers={"Authorization": "Basic abc"})
        malformed_jwt = await client.get("/v1/me", headers={"Authorization": "Bearer not.a.jwt"})
        client.cookies.set("__session", _token(private_key, "cookie"))
        cookie = await client.get("/v1/me")
        expired_response = await client.get(
            "/v1/me", headers={"Authorization": f"Bearer {expired}"}
        )
        for response in (missing, malformed, malformed_jwt, cookie):
            assert response.status_code == 401
            assert response.json()["code"] == "unauthenticated"
            assert response.headers["www-authenticate"] == "Bearer"
        assert expired_response.status_code == 401
        assert expired_response.json()["code"] == "token_expired"
    finally:
        await client.aclose()
        await auth_client.aclose()


async def test_me_patch_validates_and_returns_current_users_profile(
    tenant_database: TenantDatabaseURLs,
) -> None:
    private_key, jwk = _test_key()
    provider, auth_client = _auth_provider(jwk)
    client, _ = await _make_client(tenant_database, provider)
    token = _token(private_key, "profile-updates")
    headers = {"Authorization": f"Bearer {token}"}
    try:
        current = await client.get("/v1/me", headers=headers)
        assert current.status_code == 200
        assert current.json()["timezone"] == "Africa/Accra"
        changed = await client.patch(
            "/v1/me",
            headers=headers,
            json={"display_name": "  Ama K.  ", "timezone": "Africa/Accra"},
        )
        assert changed.status_code == 200
        assert changed.json()["display_name"] == "Ama K."
        assert changed.json()["timezone"] == "Africa/Accra"
        for payload in (
            {"timezone": "Not/A_Zone"},
            {"currency": "USD"},
            {"unknown": "value"},
            {"display_name": "x" * 101},
            {"display_name": "   "},
        ):
            response = await client.patch("/v1/me", headers=headers, json=payload)
            assert response.status_code == 422
    finally:
        await client.aclose()
        await auth_client.aclose()


async def test_users_self_rls_and_app_role_permissions(
    tenant_database: TenantDatabaseURLs,
    app_session_factory: SessionFactory,
    tenant_a: UUID,
    tenant_b: UUID,
) -> None:
    identity_a = VerifiedIdentity("clerk", "users-rls-a")
    identity_b = VerifiedIdentity("clerk", "users-rls-b")
    user_a = await get_or_provision_user_id(identity_a, app_session_factory)
    user_b = await get_or_provision_user_id(identity_b, app_session_factory)

    async with system_session(app_session_factory) as session:
        visible = await session.scalar(text("SELECT count(*) FROM users"))
    assert visible == 0

    async with tenant_session(tenant_a, app_session_factory) as session:
        with pytest.raises(DBAPIError):
            await session.execute(
                text(
                    "INSERT INTO users (id, auth_provider, auth_subject) "
                    "VALUES (:id, 'test', 'forbidden')"
                ),
                {"id": tenant_a},
            )
    async with tenant_session(tenant_a, app_session_factory) as session:
        with pytest.raises(DBAPIError):
            await session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_a})
    async with tenant_session(user_a, app_session_factory) as session:
        other_user = await session.scalar(
            text("SELECT id FROM users WHERE id = :id"), {"id": user_b}
        )
        updated_user = await session.scalar(
            text("UPDATE users SET display_name = 'forged' WHERE id = :id RETURNING id"),
            {"id": user_b},
        )
    assert other_user is None
    assert updated_user is None

    private_key, jwk = _test_key()
    provider, auth_client = _auth_provider(jwk)
    client, _ = await _make_client(tenant_database, provider)
    token_a = _token(private_key, "users-rls-a")
    token_b = _token(private_key, "users-rls-b")
    try:
        response_a = await client.get("/v1/me", headers={"Authorization": f"Bearer {token_a}"})
        response_b = await client.get("/v1/me", headers={"Authorization": f"Bearer {token_b}"})
        assert UUID(response_a.json()["id"]) == user_a
        assert UUID(response_b.json()["id"]) == user_b
        async with system_session(app_session_factory) as session:
            policies = await session.execute(
                text(
                    "SELECT policyname, cmd, roles, qual, with_check FROM pg_policies "
                    "WHERE schemaname = 'public' AND tablename = 'users' ORDER BY policyname"
                )
            )
            policy_rows = policies.all()
            assert {(row.policyname, row.cmd, tuple(row.roles)) for row in policy_rows} == {
                ("user_provision_insert", "INSERT", ("largent_migrator",)),
                ("user_provision_select", "SELECT", ("largent_migrator",)),
                ("user_self", "SELECT", ("largent_app",)),
                ("user_self_update", "UPDATE", ("largent_app",)),
            }
            policy_expressions = {row.policyname: (row.qual, row.with_check) for row in policy_rows}
            select_using, select_check = policy_expressions["user_self"]
            assert "app.user_id" in select_using
            assert "id" in select_using
            assert select_check is None
            for expression in policy_expressions["user_self_update"]:
                assert "app.user_id" in expression
                assert "id" in expression
            grants = await session.execute(
                text(
                    "SELECT privilege_type FROM information_schema.table_privileges "
                    "WHERE table_schema = 'public' AND table_name = 'users' "
                    "AND grantee = 'largent_app'"
                )
            )
            assert {row[0] for row in grants} == {"SELECT", "UPDATE"}
            public_execute = await session.execute(
                text(
                    "SELECT p.proname, EXISTS ("
                    "SELECT 1 FROM aclexplode(p.proacl) a "
                    "WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') "
                    "FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
                    "WHERE n.nspname = 'public' AND p.proname IN ('resolve_user', 'provision_user')"
                )
            )
            assert set(public_execute.all()) == {("resolve_user", False), ("provision_user", False)}
            execute_acl = await session.execute(
                text(
                    "SELECT p.proname, r.rolname, a.privilege_type "
                    "FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
                    "CROSS JOIN LATERAL aclexplode(p.proacl) a "
                    "LEFT JOIN pg_roles r ON r.oid = a.grantee "
                    "WHERE n.nspname = 'public' AND p.proname IN ('resolve_user', 'provision_user')"
                )
            )
            assert set(execute_acl.all()) == {
                ("resolve_user", "largent_migrator", "EXECUTE"),
                ("resolve_user", "largent_app", "EXECUTE"),
                ("provision_user", "largent_migrator", "EXECUTE"),
                ("provision_user", "largent_app", "EXECUTE"),
            }
    finally:
        await client.aclose()
        await auth_client.aclose()


async def test_unavailable_jwks_returns_non_leaking_503(
    tenant_database: TenantDatabaseURLs,
) -> None:
    private_key, _ = _test_key()
    client_for_jwks = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: (_ for _ in ()).throw(httpx.ConnectError("do not disclose"))
        )
    )
    provider = ClerkAuthProvider(
        issuer=ISSUER,
        audience=AUDIENCE,
        authorized_parties=[AUTHORIZED_PARTY],
        client=client_for_jwks,
    )
    client, _ = await _make_client(tenant_database, provider)
    token = _token(private_key, "provider-outage")
    try:
        response = await client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 503
        assert response.json()["code"] == "auth_provider_unavailable"
        assert "do not disclose" not in response.text
    finally:
        await client.aclose()
        await client_for_jwks.aclose()
