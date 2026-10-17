"""Structured, privacy-preserving request logging."""

from __future__ import annotations

import logging
import sys
import time
from collections.abc import Awaitable, Callable
from uuid import uuid4

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


def configure_logging(log_level: str) -> None:
    """Configure JSON logs once per process without request payload processors."""
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=log_level, force=True)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, log_level)),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=False,
    )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Attach a request ID and emit metadata-only request completion events."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self.logger = structlog.get_logger(__name__)

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        started = time.perf_counter()
        tokens = structlog.contextvars.bind_contextvars(request_id=request_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            route = request.scope.get("route")
            path_template = getattr(route, "path", "unmatched")
            self.logger.info(
                "request_completed",
                method=request.method,
                path=path_template,
                status_code=response.status_code,
                duration_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            return response
        finally:
            structlog.contextvars.reset_contextvars(**tokens)
