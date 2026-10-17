"""FastAPI application factory for the Largent API."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from time import perf_counter

import sentry_sdk
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from largent.core.config import Settings
from largent.core.db import check_database, create_engine, create_session_factory
from largent.core.errors import install_error_handlers, problem_response
from largent.core.logging import RequestLoggingMiddleware, configure_logging
from largent.core.redis import check_redis, create_redis


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Set baseline browser protections on every response."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        return response


def configure_telemetry(settings: Settings, app: FastAPI) -> None:
    """Instrument FastAPI and export traces only when configured."""
    if settings.otlp_endpoint:
        provider = TracerProvider()
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otlp_endpoint))
        )
        trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build an application without performing network I/O."""
    active_settings = settings or Settings()
    configure_logging(active_settings.log_level)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await app.state.redis.aclose()
        await app.state.engine.dispose()

    app = FastAPI(title="Largent API", version="0.1.0", lifespan=lifespan)
    app.state.settings = active_settings
    app.state.engine = create_engine(active_settings)
    app.state.session_factory = create_session_factory(app.state.engine)
    app.state.redis = create_redis(active_settings)

    if active_settings.sentry_dsn:
        sentry_sdk.init(dsn=active_settings.sentry_dsn, environment=active_settings.environment)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Accept",
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "X-Request-ID",
        ],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    install_error_handlers(app)
    configure_telemetry(active_settings, app)

    @app.get("/healthz", include_in_schema=False)
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz", include_in_schema=False)
    async def readyz() -> Response:
        failures: list[str] = []
        started = perf_counter()
        try:
            await check_database(app.state.engine)
        except Exception:
            structlog.get_logger(__name__).warning("dependency_check_failed", dependency="postgres")
            failures.append("postgres")
        try:
            await check_redis(app.state.redis)
        except Exception:
            structlog.get_logger(__name__).warning("dependency_check_failed", dependency="redis")
            failures.append("redis")
        if failures:
            return problem_response(
                status=503,
                title="Service unavailable",
                detail="A required dependency is unavailable.",
                code="dependency_unavailable",
                extensions={"dependencies": failures},
            )
        structlog.get_logger(__name__).info(
            "readiness_check_completed", duration_ms=round((perf_counter() - started) * 1000, 2)
        )
        return Response(content='{"status":"ok"}', media_type="application/json")

    return app
