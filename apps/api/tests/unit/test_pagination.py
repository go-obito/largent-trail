"""Signed keyset cursor tests."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta, timezone
from uuid import UUID

import pytest

from largent.core.pagination import (
    InvalidCursor,
    PageCursor,
    build_dated_page,
    build_page,
    decode_cursor,
    encode_cursor,
)

KEY = b"unit-test-cursor-signing-secret-32-bytes"
OLD_KEY = b"old-rotation-secret-key-32-bytes-0001"
NEW_KEY = b"new-rotation-secret-key-32-bytes-0002"
CURSOR = PageCursor(
    position=4,
    created_at=datetime(2026, 10, 18, 12, 30, 0, 123456, tzinfo=UTC),
    row_id=UUID("019a0000-0000-7000-8000-000000000001"),
)


def test_cursor_round_trip_preserves_microseconds() -> None:
    encoded = encode_cursor(CURSOR, [KEY])
    assert decode_cursor(encoded, [KEY]) == CURSOR


def test_cursor_is_opaque_url_safe_text() -> None:
    encoded = encode_cursor(CURSOR, [KEY])
    assert all(char.isalnum() or char in "-_." for char in encoded)
    assert "019a0000" not in encoded


def test_non_utc_timestamps_round_trip_as_the_same_instant() -> None:
    accra_plus_one = timezone(timedelta(hours=1))
    cursor = PageCursor(2, CURSOR.created_at.astimezone(accra_plus_one), CURSOR.row_id)
    assert decode_cursor(encode_cursor(cursor, [KEY]), [KEY]).created_at == CURSOR.created_at


@pytest.mark.parametrize(
    "cursor",
    ["", "not-a-cursor", "a.b", "a.b.c", "!invalid!.signature", "x" * 513],
)
def test_malformed_cursor_is_rejected(cursor: str) -> None:
    with pytest.raises(InvalidCursor):
        decode_cursor(cursor, [KEY])


def test_tampered_signature_is_rejected() -> None:
    encoded = encode_cursor(CURSOR, [KEY])
    tampered = encoded[:-1] + ("A" if encoded[-1] != "A" else "B")
    with pytest.raises(InvalidCursor):
        decode_cursor(tampered, [KEY])


def test_tampered_payload_is_rejected() -> None:
    forged = PageCursor(0, CURSOR.created_at, CURSOR.row_id)
    payload_part = encode_cursor(forged, [KEY]).split(".")[0]
    signature_part = encode_cursor(CURSOR, [KEY]).split(".")[1]
    with pytest.raises(InvalidCursor):
        decode_cursor(f"{payload_part}.{signature_part}", [KEY])


def test_cursor_signed_with_an_unknown_key_is_rejected() -> None:
    encoded = encode_cursor(CURSOR, [OLD_KEY])
    with pytest.raises(InvalidCursor):
        decode_cursor(encoded, [NEW_KEY])


def test_rotation_first_key_signs_and_all_keys_verify() -> None:
    old_cursor = encode_cursor(CURSOR, [OLD_KEY])
    assert decode_cursor(old_cursor, [NEW_KEY, OLD_KEY]) == CURSOR

    new_cursor = encode_cursor(CURSOR, [NEW_KEY, OLD_KEY])
    assert decode_cursor(new_cursor, [NEW_KEY]) == CURSOR
    with pytest.raises(InvalidCursor):
        decode_cursor(new_cursor, [OLD_KEY])


def test_correctly_signed_payload_of_the_wrong_shape_is_rejected() -> None:
    import base64
    import hashlib
    import hmac

    def signed(payload: bytes) -> str:
        signature = hmac.digest(KEY, payload, hashlib.sha256)
        parts = (
            base64.urlsafe_b64encode(part).rstrip(b"=").decode() for part in (payload, signature)
        )
        return ".".join(parts)

    for payload in (
        b"[]",
        b'{"i":"x"}',
        b'{"i":"019a0000000070008000000000000001","p":-1,"t":"2026-10-18T12:30:00+00:00"}',
        b'{"i":"019a0000000070008000000000000001","p":true,"t":"2026-10-18T12:30:00+00:00"}',
        b'{"i":"019a0000000070008000000000000001","p":1,"t":"2026-10-18T12:30:00"}',
        b'{"i":"not-a-uuid","p":1,"t":"2026-10-18T12:30:00+00:00"}',
        b"\xff\xfe",
    ):
        with pytest.raises(InvalidCursor):
            decode_cursor(signed(payload), [KEY])


@pytest.mark.parametrize("keys", [[], [b"too-short"], [KEY, b"too-short"]])
def test_missing_or_weak_key_material_is_a_programming_error(keys: list[bytes]) -> None:
    with pytest.raises(ValueError, match="at least one key") as encode_failure:
        encode_cursor(CURSOR, keys)
    assert not isinstance(encode_failure.value, InvalidCursor)
    with pytest.raises(ValueError, match="at least one key") as decode_failure:
        decode_cursor("a.b", keys)
    assert not isinstance(decode_failure.value, InvalidCursor)


def test_naive_timestamp_cannot_be_encoded() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        encode_cursor(PageCursor(0, datetime(2026, 10, 18), CURSOR.row_id), [KEY])


@dataclass(frozen=True)
class Row:
    position: int
    created_at: datetime
    id: UUID


def _rows(count: int) -> list[Row]:
    return [Row(index, CURSOR.created_at, UUID(int=index + 1)) for index in range(count)]


def test_build_page_signs_a_cursor_for_the_last_returned_row_when_more_remain() -> None:
    rows = _rows(4)

    page, cursor = build_page(rows, 3, [KEY])

    assert page == rows[:3]
    assert cursor is not None
    assert decode_cursor(cursor, [KEY]) == PageCursor(2, CURSOR.created_at, rows[2].id)


@pytest.mark.parametrize("count", [0, 1, 3])
def test_build_page_has_no_cursor_when_the_page_is_the_last(count: int) -> None:
    page, cursor = build_page(_rows(count), 3, [KEY])

    assert len(page) == count
    assert cursor is None


DATED_CURSOR = PageCursor(0, CURSOR.created_at, CURSOR.row_id, date(2026, 10, 17))


def test_dated_cursor_round_trips_only_through_dated_decoding() -> None:
    encoded = encode_cursor(DATED_CURSOR, [KEY])

    assert decode_cursor(encoded, [KEY], dated=True) == DATED_CURSOR
    with pytest.raises(InvalidCursor):
        decode_cursor(encoded, [KEY])


def test_an_undated_cursor_is_rejected_by_dated_decoding() -> None:
    with pytest.raises(InvalidCursor):
        decode_cursor(encode_cursor(CURSOR, [KEY]), [KEY], dated=True)


def test_a_dated_cursor_with_a_bad_date_is_rejected() -> None:
    import base64
    import hashlib
    import hmac

    for bad in ('"2026-02-30"', "20", '"x"', "null"):
        payload = (
            b'{"d":' + bad.encode() + b',"i":"019a0000000070008000000000000001","p":0,'
            b'"t":"2026-10-18T12:30:00+00:00"}'
        )
        signature = hmac.digest(KEY, payload, hashlib.sha256)
        value = ".".join(
            base64.urlsafe_b64encode(part).rstrip(b"=").decode() for part in (payload, signature)
        )
        with pytest.raises(InvalidCursor):
            decode_cursor(value, [KEY], dated=True)


@dataclass(frozen=True)
class DatedRow:
    occurred_on: date
    created_at: datetime
    id: UUID


def test_build_dated_page_signs_the_last_rows_date_key() -> None:
    rows = [DatedRow(date(2026, 10, 18 - i), CURSOR.created_at, UUID(int=i + 1)) for i in range(4)]

    page, cursor = build_dated_page(rows, 3, [KEY])

    assert page == rows[:3]
    assert cursor is not None
    assert decode_cursor(cursor, [KEY], dated=True) == PageCursor(
        0, CURSOR.created_at, rows[2].id, rows[2].occurred_on
    )


@pytest.mark.parametrize("count", [0, 1, 3])
def test_build_dated_page_has_no_cursor_on_the_last_page(count: int) -> None:
    rows = [DatedRow(date(2026, 10, 18), CURSOR.created_at, UUID(int=i + 1)) for i in range(count)]

    page, cursor = build_dated_page(rows, 3, [KEY])

    assert len(page) == count
    assert cursor is None
