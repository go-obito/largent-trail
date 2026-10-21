"""Authenticated CSV import preview and parse endpoints."""

from __future__ import annotations

import time
from collections.abc import Awaitable
from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.clock import utc_now
from largent.core.errors import ProblemHTTPException
from largent.core.ids import new_uuid7
from largent.core.tenancy import get_current_user_id, get_tenant_session
from largent.modules.imports import service
from largent.modules.imports.schemas import (
    ImportParseRequest,
    ImportParseResponse,
    ImportPreviewResponse,
)

router = APIRouter()
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
Now = Annotated[datetime, Depends(utc_now)]
PREVIEW_TTL_SECONDS = 30 * 60
PREVIEWS_PER_HOUR = 10
_INCREMENT_RATE_LIMIT = (
    "local now = tonumber(ARGV[1]); "
    "local window = tonumber(ARGV[2]); "
    "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window); "
    "local count = redis.call('ZCARD', KEYS[1]); "
    "if count >= tonumber(ARGV[3]) then "
    "local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES'); "
    "return {0, math.ceil(tonumber(oldest[2]) + window - now)}; "
    "end; "
    "redis.call('ZADD', KEYS[1], now, ARGV[4]); "
    "redis.call('EXPIRE', KEYS[1], window); "
    "return {1, 0}"
)


def _error(
    status_code: int,
    title: str,
    detail: str,
    code: str,
    headers: dict[str, str] | None = None,
) -> ProblemHTTPException:
    return ProblemHTTPException(
        status_code=status_code,
        title=title,
        detail=detail,
        code=code,
        headers=headers,
    )


async def _check_preview_rate(redis: Redis, user_id: UUID) -> None:
    now = time.time()
    key = f"import:preview-rate:{user_id}"
    result = cast(
        Awaitable[list[int]],
        redis.eval(
            _INCREMENT_RATE_LIMIT,
            1,
            key,
            str(now),
            "3600",
            str(PREVIEWS_PER_HOUR),
            str(new_uuid7()),
        ),
    )
    allowed, retry_after = await result
    if not int(allowed):
        raise _error(
            429,
            "Rate limited",
            "The preview limit is 10 requests per hour.",
            "rate_limited",
            headers={"Retry-After": str(max(1, int(retry_after)))},
        )


def _validate_upload_headers(request: Request) -> None:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if content_type not in {"text/csv", "application/octet-stream"}:
        raise _error(
            415,
            "Unsupported media type",
            "Upload the CSV as a raw text/csv or application/octet-stream body.",
            "unsupported_media_type",
        )

    content_length = request.headers.get("content-length")
    if content_length is not None:
        if not content_length.isascii() or not content_length.isdigit():
            raise _error(
                400,
                "Invalid content length",
                "The Content-Length header is invalid.",
                "invalid_content_length",
            )
        normalized_length = content_length.lstrip("0") or "0"
        maximum_length = str(service.MAX_FILE_BYTES)
        if len(normalized_length) > len(maximum_length) or (
            len(normalized_length) == len(maximum_length) and normalized_length > maximum_length
        ):
            raise _error(
                413,
                "File too large",
                "CSV uploads must not exceed 2 MB.",
                "file_too_large",
            )


async def _read_upload(request: Request) -> bytes:
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > service.MAX_FILE_BYTES:
            raise _error(
                413,
                "File too large",
                "CSV uploads must not exceed 2 MB.",
                "file_too_large",
            )
        if b"\x00" in chunk:
            raise _error(
                422,
                "Not a CSV file",
                "The uploaded file contains binary data.",
                "not_csv",
            )
        content.extend(chunk)
    return bytes(content)


@router.post(
    "/preview",
    response_model=ImportPreviewResponse,
    openapi_extra={
        "requestBody": {
            "required": True,
            "description": (
                "Raw CSV request body, not multipart. Maximum 2 MB; at most 1,000 data rows."
            ),
            "content": {
                "text/csv": {
                    "schema": {"type": "string", "format": "binary"},
                    "example": "date,description,amount\n21/10/2026,Coffee,-12.50\n",
                },
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}},
            },
        }
    },
    responses={
        413: {"description": "file_too_large"},
        422: {"description": "not_csv, too_many_rows, too_many_columns, or cell_too_long"},
        429: {
            "description": "rate_limited",
            "headers": {
                "Retry-After": {
                    "description": "Seconds until another preview request is allowed.",
                    "schema": {"type": "integer"},
                }
            },
        },
    },
)
async def preview_import(
    request: Request,
    user_id: CurrentUserId,
) -> ImportPreviewResponse:
    """Inspect a raw CSV upload and retain its normalized text for 30 minutes."""
    redis = cast(Redis, request.app.state.redis)
    _validate_upload_headers(request)
    await _check_preview_rate(redis, user_id)
    content = await _read_upload(request)
    text, encoding = service.decode_upload(content)
    preview_id = new_uuid7()
    preview, normalized_text = service.preview_response(preview_id, text, encoding)
    await redis.set(f"import:{user_id}:{preview_id}", normalized_text, ex=PREVIEW_TTL_SECONDS)
    return preview


@router.post(
    "/{preview_id}/parse",
    response_model=ImportParseResponse,
    responses={
        404: {"description": "preview_not_found"},
        422: {"description": "invalid_mapping or row-level parse errors"},
    },
)
async def parse_import(
    preview_id: UUID,
    payload: ImportParseRequest,
    request: Request,
    user_id: CurrentUserId,
    session: TenantSession,
    now: Now,
) -> ImportParseResponse:
    """Validate selected columns and return row results without inserting transactions."""
    redis = cast(Redis, request.app.state.redis)
    normalized_text = await redis.get(f"import:{user_id}:{preview_id}")
    if normalized_text is None:
        raise _error(
            404,
            "Preview not found",
            "The CSV preview was not found or has expired.",
            "preview_not_found",
        )
    return await service.parse_import(session, user_id, normalized_text, payload, now)
