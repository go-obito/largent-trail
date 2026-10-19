"""Signed opaque keyset cursors for stable tenant-list pagination."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Protocol, cast
from uuid import UUID

from fastapi import Request

from largent.core.config import Settings

DEFAULT_LIMIT = 50
MAX_LIMIT = 200
MAX_CURSOR_LENGTH = 512
MIN_KEY_BYTES = 32


def get_cursor_signing_keys(request: Request) -> list[bytes]:
    """FastAPI dependency: the active cursor keys (first signs, all verify)."""
    return cast(Settings, request.app.state.settings).cursor_signing_key_bytes


class InvalidCursor(ValueError):
    """Raised when a cursor is malformed or its signature is invalid."""


@dataclass(frozen=True, slots=True)
class PageCursor:
    """Last-seen sort key: (position, created_at, id), or (occurred_on, created_at, id) if dated."""

    position: int
    created_at: datetime
    row_id: UUID
    occurred_on: date | None = None


def _require_keys(keys: Sequence[bytes]) -> Sequence[bytes]:
    if not keys or any(len(key) < MIN_KEY_BYTES for key in keys):
        raise ValueError(f"cursor signing needs at least one key of {MIN_KEY_BYTES}+ bytes")
    return keys


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)


def encode_cursor(cursor: PageCursor, keys: Sequence[bytes]) -> str:
    """Encode a keyset position as `payload.signature`, signed with the first key."""
    signing_key = _require_keys(keys)[0]
    if type(cursor.position) is not int or cursor.position < 0:
        raise ValueError("cursor position must be a non-negative integer")
    if cursor.created_at.utcoffset() is None:
        raise ValueError("cursor timestamp must be timezone-aware")
    payload_fields: dict[str, str | int] = {
        "i": cursor.row_id.hex,
        "p": cursor.position,
        "t": cursor.created_at.astimezone(UTC).isoformat(timespec="microseconds"),
    }
    if cursor.occurred_on is not None:
        payload_fields["d"] = cursor.occurred_on.isoformat()
    payload = json.dumps(payload_fields, separators=(",", ":"), sort_keys=True).encode("ascii")
    signature = hmac.digest(signing_key, payload, hashlib.sha256)
    return f"{_b64encode(payload)}.{_b64encode(signature)}"


def decode_cursor(value: str, keys: Sequence[bytes], *, dated: bool = False) -> PageCursor:
    """Verify a cursor against every active key and decode it.

    `dated` selects the cursor shape the endpoint expects; the other shape is rejected.
    Raises `InvalidCursor` for any bad encoding, signature or payload shape.
    """
    active_keys = _require_keys(keys)
    if not value or len(value) > MAX_CURSOR_LENGTH:
        raise InvalidCursor("invalid cursor")
    try:
        payload_part, signature_part = value.split(".")
        payload = _b64decode(payload_part)
        signature = _b64decode(signature_part)
    except (ValueError, binascii.Error) as exc:
        raise InvalidCursor("invalid cursor") from exc
    verified = False
    for key in active_keys:
        expected = hmac.digest(key, payload, hashlib.sha256)
        verified = hmac.compare_digest(signature, expected) or verified
    if not verified:
        raise InvalidCursor("invalid cursor")
    return _parse_payload(payload, dated=dated)


class KeysetRow(Protocol):
    """A row ordered by (position, created_at, id)."""

    @property
    def position(self) -> int: ...

    @property
    def created_at(self) -> datetime: ...

    @property
    def id(self) -> UUID: ...


def build_page[T: KeysetRow](
    rows: Sequence[T], limit: int, keys: Sequence[bytes]
) -> tuple[list[T], str | None]:
    """Trim a `limit + 1` fetch to a page and sign the next cursor if more rows remain."""
    page = list(rows[:limit])
    if len(rows) <= limit or not page:
        return page, None
    last = page[-1]
    return page, encode_cursor(PageCursor(last.position, last.created_at, last.id), keys)


class DatedKeysetRow(Protocol):
    """A row ordered by (occurred_on, created_at, id), newest first."""

    @property
    def occurred_on(self) -> date: ...

    @property
    def created_at(self) -> datetime: ...

    @property
    def id(self) -> UUID: ...


def build_dated_page[T: DatedKeysetRow](
    rows: Sequence[T], limit: int, keys: Sequence[bytes]
) -> tuple[list[T], str | None]:
    """Like `build_page`, for rows keyed by (occurred_on, created_at, id)."""
    page = list(rows[:limit])
    if len(rows) <= limit or not page:
        return page, None
    last = page[-1]
    cursor = PageCursor(0, last.created_at, last.id, last.occurred_on)
    return page, encode_cursor(cursor, keys)


class CreatedKeysetRow(Protocol):
    """A row ordered by (created_at, id), oldest first."""

    @property
    def created_at(self) -> datetime: ...

    @property
    def id(self) -> UUID: ...


def build_created_page[T: CreatedKeysetRow](
    rows: Sequence[T], limit: int, keys: Sequence[bytes]
) -> tuple[list[T], str | None]:
    """Like `build_page`, for rows without a position, keyed by (created_at, id)."""
    page = list(rows[:limit])
    if len(rows) <= limit or not page:
        return page, None
    last = page[-1]
    return page, encode_cursor(PageCursor(0, last.created_at, last.id), keys)


def _parse_payload(payload: bytes, *, dated: bool) -> PageCursor:
    try:
        raw: object = json.loads(payload)
        if not isinstance(raw, dict) or set(raw) != (
            {"d", "i", "p", "t"} if dated else {"i", "p", "t"}
        ):
            raise ValueError("unexpected cursor shape")
        position, timestamp, row_id = raw["p"], raw["t"], raw["i"]
        if type(position) is not int or position < 0:
            raise ValueError("bad position")
        if not isinstance(timestamp, str) or not isinstance(row_id, str):
            raise ValueError("bad field type")
        occurred_on = _parse_date(raw["d"]) if dated else None
        created_at = datetime.fromisoformat(timestamp)
        if created_at.utcoffset() is None:
            raise ValueError("naive timestamp")
        return PageCursor(position, created_at, UUID(row_id), occurred_on)
    except (ValueError, TypeError, UnicodeDecodeError) as exc:
        raise InvalidCursor("invalid cursor") from exc


def _parse_date(value: object) -> date:
    if not isinstance(value, str):
        raise ValueError("bad date")
    return date.fromisoformat(value)
