"""RFC 9457 error responses and exception handlers."""

from __future__ import annotations

from collections.abc import Mapping

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from largent.core.pagination import InvalidCursor
from largent.domain.errors import DomainConflict, DomainRuleViolation

PROBLEM_MEDIA_TYPE = "application/problem+json"

_CONFLICT_DETAILS = {
    "duplicate_name": "An active record already uses this name.",
    "duplicate_budget": "An active budget already exists for this category and period.",
    "id_conflict": "This ID cannot be used.",
}

_RULE_TITLES_AND_DETAILS = {
    "invalid_reference": ("Invalid reference", "The referenced record cannot be used."),
    "archived_reference": ("Archived reference", "The referenced record is archived."),
    "kind_mismatch": ("Kind mismatch", "The category kind is not valid for this record."),
    "invalid_date": ("Invalid date", "The date is outside the allowed range."),
    "limit_reached": ("Limit reached", "The maximum number of active records is reached."),
    "invalid_order": ("Invalid order", "The order must list every active record exactly once."),
}


class ProblemHTTPException(HTTPException):
    """HTTP error carrying a stable RFC 9457 problem identity."""

    def __init__(
        self,
        *,
        status_code: int,
        title: str,
        detail: str,
        code: str,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.problem_title = title
        self.problem_code = code


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

    @app.exception_handler(InvalidCursor)
    async def invalid_cursor_handler(_: Request, __: InvalidCursor) -> JSONResponse:
        return problem_response(
            status=400,
            title="Invalid cursor",
            detail="The pagination cursor is invalid.",
            code="invalid_cursor",
        )

    @app.exception_handler(DomainConflict)
    async def domain_conflict_handler(_: Request, exc: DomainConflict) -> JSONResponse:
        return problem_response(
            status=409, title="Conflict", detail=_CONFLICT_DETAILS[exc.code], code=exc.code
        )

    @app.exception_handler(DomainRuleViolation)
    async def domain_rule_handler(_: Request, exc: DomainRuleViolation) -> JSONResponse:
        title, detail = _RULE_TITLES_AND_DETAILS[exc.code]
        return problem_response(
            status=422, title=title, detail=detail, code=exc.code, extensions={"field": exc.field}
        )

    @app.exception_handler(HTTPException)
    async def http_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
        unauthenticated = exc.status_code == 401
        problem_title = getattr(exc, "problem_title", None)
        problem_code = getattr(exc, "problem_code", None)
        detail = (
            exc.detail if isinstance(exc.detail, str) else "The request could not be completed."
        )
        response = problem_response(
            status=exc.status_code,
            title=problem_title
            or ("Authentication required" if unauthenticated else "Request failed"),
            detail=detail,
            code=problem_code or ("unauthenticated" if unauthenticated else "http_error"),
        )
        if exc.headers:
            response.headers.update(exc.headers)
        return response

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
