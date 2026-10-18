"""RFC 9457 error responses and exception handlers."""

from __future__ import annotations

from collections.abc import Mapping

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

PROBLEM_MEDIA_TYPE = "application/problem+json"


def problem_response(
    *,
    status: int,
    title: str,
    detail: str,
    code: str,
    extensions: Mapping[str, object] | None = None,
) -> JSONResponse:
    """Create a stable, JSON-only RFC 9457 response."""
    body: dict[str, object] = {
        "type": f"https://largent.app/problems/{code}",
        "title": title,
        "status": status,
        "detail": detail,
        "code": code,
    }
    if extensions:
        body.update(extensions)
    return JSONResponse(status_code=status, content=body, media_type=PROBLEM_MEDIA_TYPE)


def install_error_handlers(app: FastAPI) -> None:
    """Install handlers that never expose exception internals to callers."""

    logger = structlog.get_logger(__name__)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, __: RequestValidationError) -> JSONResponse:
        return problem_response(
            status=422,
            title="Validation failed",
            detail="The request could not be validated.",
            code="validation_error",
        )

    @app.exception_handler(HTTPException)
    async def http_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
        unauthenticated = exc.status_code == 401
        detail = (
            exc.detail if isinstance(exc.detail, str) else "The request could not be completed."
        )
        return problem_response(
            status=exc.status_code,
            title="Authentication required" if unauthenticated else "Request failed",
            detail=detail,
            code="unauthenticated" if unauthenticated else "http_error",
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.exception("unhandled_exception", request_id=request_id)
        response = problem_response(
            status=500,
            title="Internal server error",
            detail="An unexpected error occurred.",
            code="internal_error",
        )
        if request_id is not None:
            response.headers["X-Request-ID"] = request_id
        return response
