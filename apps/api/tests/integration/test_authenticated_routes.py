"""Default authentication and production app construction contracts."""

from __future__ import annotations

import httpx
import pytest
from tests.conftest import make_settings

from largent.main import create_app

PUBLIC_ROUTE_ALLOWLIST = {
    ("/healthz", "GET"),
    ("/readyz", "GET"),
    ("/docs", "GET"),
    ("/docs", "HEAD"),
    ("/redoc", "GET"),
    ("/redoc", "HEAD"),
    ("/openapi.json", "GET"),
    ("/openapi.json", "HEAD"),
    ("/docs/oauth2-redirect", "GET"),
    ("/docs/oauth2-redirect", "HEAD"),
}


def _route_inventory(routes: list[object], prefix: str = "") -> list[tuple[str, str]]:
    inventory: list[tuple[str, str]] = []
    for route in routes:
        original_router = getattr(route, "original_router", None)
        if original_router is not None:
            include_prefix = getattr(getattr(route, "include_context", None), "prefix", "")
            router_prefix = include_prefix or original_router.prefix
            effective_prefix = (
                router_prefix
                if prefix and router_prefix.startswith(prefix)
                else f"{prefix}{router_prefix}"
            )
            inventory.extend(_route_inventory(original_router.routes, effective_prefix))
            continue
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None)
        if isinstance(path, str) and methods:
            inventory.extend((f"{prefix}{path}", method) for method in methods)
    return inventory


async def test_every_real_route_outside_public_allowlist_requires_auth() -> None:
    app = create_app(make_settings())
    routes = _route_inventory(list(app.routes))
    protected_routes = [route for route in routes if route not in PUBLIC_ROUTE_ALLOWLIST]
    assert ("/v1/me", "GET") in protected_routes
    assert ("/v1/me", "PATCH") in protected_routes
    for method, path in (
        ("GET", "/v1/accounts"),
        ("POST", "/v1/accounts"),
        ("GET", "/v1/accounts/{account_id}"),
        ("PATCH", "/v1/accounts/{account_id}"),
        ("DELETE", "/v1/accounts/{account_id}"),
    ):
        assert (path, method) in protected_routes

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        for path, method in protected_routes:
            response = await client.request(method, path)
            assert response.status_code == 401, f"{method} {path} was reachable without auth"
            assert response.headers.get("www-authenticate") == "Bearer"
            assert response.headers["content-type"] == "application/problem+json"
            assert response.json()["code"] == "unauthenticated"


def test_production_rejects_non_clerk_provider() -> None:
    with pytest.raises(RuntimeError, match="Production requires AUTH_PROVIDER=clerk"):
        create_app(make_settings(environment="production", auth_provider="fake"))


def test_production_disables_docs_redoc_and_openapi_routes() -> None:
    app = create_app(make_settings(environment="production"))
    assert app.docs_url is None
    assert app.redoc_url is None
    assert app.openapi_url is None
    paths = {getattr(route, "path", None) for route in app.routes}
    assert "/docs" not in paths
    assert "/redoc" not in paths
    assert "/openapi.json" not in paths
