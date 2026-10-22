"""Public error and request-log behavior tests."""

from __future__ import annotations

import json
import socket
from unittest.mock import AsyncMock

import httpx
from pytest import CaptureFixture, MonkeyPatch
from tests.conftest import make_settings

from largent.main import create_app


async def test_validation_error_is_problem_json() -> None:
    app = create_app(make_settings())

    @app.get("/test/items/{item_id}")
    async def get_item(item_id: int) -> dict[str, int]:
        return {"item_id": item_id}

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/test/items/not-an-integer")

    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["code"] == "validation_error"
    assert response.json()["status"] == 422


async def test_unhandled_error_is_problem_json_without_exception_text(
    capsys: CaptureFixture[str],
) -> None:
    app = create_app(make_settings())

    @app.get("/test/boom")
    async def boom() -> None:
        raise RuntimeError("private implementation detail")

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as client:
        response = await client.get("/test/boom", headers={"X-Request-ID": "boom-request-id"})

    captured = capsys.readouterr().out
    assert response.status_code == 500
    assert response.headers["content-type"] == "application/problem+json"
    assert response.headers["x-request-id"] == "boom-request-id"
    assert response.json()["code"] == "internal_error"
    assert "private implementation detail" not in response.text
    assert "boom-request-id" in captured


async def test_request_id_is_propagated_and_body_is_not_logged(capsys: CaptureFixture[str]) -> None:
    app = create_app(make_settings())

    @app.post("/test/echo")
    async def echo(payload: dict[str, str]) -> dict[str, str]:
        return payload

    request_id = "test-request-id"
    body_value = "a-body-value-that-must-not-be-logged"
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/test/echo", headers={"X-Request-ID": request_id}, json={"note": body_value}
        )

    captured = capsys.readouterr().out
    json_lines = [line for line in captured.splitlines() if line.startswith("{")]
    assert json_lines
    log = json.loads(json_lines[-1])
    assert response.headers["x-request-id"] == request_id
    assert log["request_id"] == request_id
    assert body_value not in captured


async def test_schema_revision_mismatch_warns_without_blocking_startup(
    capsys: CaptureFixture[str], monkeypatch: MonkeyPatch
) -> None:
    app = create_app(make_settings())
    monkeypatch.setattr(
        "largent.main.get_schema_revision", AsyncMock(return_value="stale-revision")
    )

    async with app.router.lifespan_context(app):
        assert app.state.engine is not None

    captured = capsys.readouterr().out
    assert "database_schema_revision_mismatch" in captured
    assert "stale-revision" in captured


async def test_schema_revision_dns_error_warns_without_blocking_startup(
    capsys: CaptureFixture[str], monkeypatch: MonkeyPatch
) -> None:
    app = create_app(make_settings())
    monkeypatch.setattr(
        "largent.main.get_schema_revision",
        AsyncMock(side_effect=socket.gaierror("database host could not be resolved")),
    )

    async with app.router.lifespan_context(app):
        assert app.state.engine is not None

    captured = capsys.readouterr().out
    assert "database_schema_revision_check_failed" in captured
    assert "gaierror" in captured
