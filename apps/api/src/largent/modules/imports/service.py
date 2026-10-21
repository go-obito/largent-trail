"""CSV decoding, validation, and parse-preview use cases."""

from __future__ import annotations

import csv
import hashlib
import io
import re
import unicodedata
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Literal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.errors import ProblemHTTPException
from largent.core.ids import new_uuid7
from largent.core.pagination import PageCursor, decode_cursor, encode_cursor
from largent.domain.money import MAX_AMOUNT_MINOR
from largent.domain.transaction_rules import MIN_OCCURRED_ON, local_today
from largent.modules.accounts import service as accounts_service
from largent.modules.categories import service as categories_service
from largent.modules.categories.models import Category, CategoryKind
from largent.modules.imports import repository
from largent.modules.imports.models import ImportBatch
from largent.modules.imports.schemas import (
    ImportBatchRead,
    ImportCommitRequest,
    ImportCommitResponse,
    ImportParsedRow,
    ImportParseRequest,
    ImportParseResponse,
    ImportPreviewResponse,
    ImportRowChoice,
    ImportRowError,
    SuggestedMapping,
)
from largent.modules.users import service as users_service

MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_DATA_ROWS = 1_000
MAX_COLUMNS = 50
MAX_CELL_CHARACTERS = 500
MAX_PREVIEW_ROWS = 20
_DELIMITERS = ",;\t|"
_DATE_FORMATS = ("DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY", "D MMM YYYY")
_DATE_PATTERNS = {
    "DD/MM/YYYY": re.compile(r"\d{2}/\d{2}/\d{4}"),
    "MM/DD/YYYY": re.compile(r"\d{2}/\d{2}/\d{4}"),
    "YYYY-MM-DD": re.compile(r"\d{4}-\d{2}-\d{2}"),
    "DD-MM-YYYY": re.compile(r"\d{2}-\d{2}-\d{4}"),
    "D MMM YYYY": re.compile(r"\d{1,2} [A-Za-z]{3} \d{4}"),
}
_MONTHS = {
    month.casefold(): index
    for index, month in enumerate(
        ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"),
        start=1,
    )
}
_AMOUNT_PATTERN = re.compile(r"(?:\d+(?:\.\d*)?|\.\d+)\Z")
_GROUPED_COMMAS_PATTERN = re.compile(r"\d{1,3}(?:,\d{3})+\Z")
_GROUPED_SPACES_PATTERN = re.compile(r"\d{1,3}(?: \d{3})+\Z")
_CURRENCY_PATTERN = re.compile(r"GHS|₵", flags=re.IGNORECASE)
csv.field_size_limit(MAX_FILE_BYTES)


def _problem(
    status_code: int,
    title: str,
    detail: str,
    code: str,
    *,
    extensions: dict[str, object] | None = None,
) -> ProblemHTTPException:
    return ProblemHTTPException(
        status_code=status_code,
        title=title,
        detail=detail,
        code=code,
        extensions=extensions,
    )


def _not_csv() -> ProblemHTTPException:
    return _problem(422, "Not a CSV file", "The uploaded file is not valid CSV text.", "not_csv")


def _read_csv(text: str) -> tuple[str, list[list[str]], bool, int]:
    """Parse and normalize a bounded CSV document, returning its guessed header state."""
    sample = "\n".join(text.splitlines()[:10])
    try:
        delimiter = csv.Sniffer().sniff(sample, delimiters=_DELIMITERS).delimiter
    except csv.Error:
        counts = [
            sum(line.count(candidate) for line in sample.splitlines()) for candidate in _DELIMITERS
        ]
        delimiter = _DELIMITERS[counts.index(max(counts))]

    try:
        reader = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter, strict=True)
        records: list[list[str]] = []
        record_count = 0
        for row in reader:
            record_count += 1
            if record_count > MAX_DATA_ROWS + 1:
                continue
            cells = [_clean_cell(cell) for cell in row]
            if len(cells) > MAX_COLUMNS:
                raise _problem(
                    422,
                    "Too many columns",
                    f"The CSV has more than {MAX_COLUMNS} columns.",
                    "too_many_columns",
                )
            if any(len(cell) > MAX_CELL_CHARACTERS for cell in cells):
                raise _problem(
                    422,
                    "Cell too long",
                    f"CSV cells must not exceed {MAX_CELL_CHARACTERS} characters.",
                    "cell_too_long",
                )
            records.append(cells)
    except csv.Error:
        raise _not_csv() from None

    if not records:
        raise _not_csv()

    has_header_guess = _looks_like_header(records[0])
    data_count = record_count - int(has_header_guess)
    if data_count > MAX_DATA_ROWS:
        raise _problem(
            422,
            "Too many rows",
            f"The CSV contains {data_count} data rows; the maximum is {MAX_DATA_ROWS}.",
            "too_many_rows",
            extensions={"row_count": data_count},
        )
    return delimiter, records, has_header_guess, data_count


def _clean_cell(value: str) -> str:
    without_controls = "".join(char for char in value if unicodedata.category(char) != "Cc")
    return unicodedata.normalize("NFC", without_controls).strip()


def _parse_date(value: str, date_format: str) -> date | None:
    if not _DATE_PATTERNS[date_format].fullmatch(value):
        return None
    try:
        if date_format in {"DD/MM/YYYY", "MM/DD/YYYY"}:
            first, second, year = (int(part) for part in value.split("/"))
            day, month = (first, second) if date_format == "DD/MM/YYYY" else (second, first)
            return date(year, month, day)
        if date_format == "YYYY-MM-DD":
            year, month, day = (int(part) for part in value.split("-"))
            return date(year, month, day)
        if date_format == "DD-MM-YYYY":
            day, month, year = (int(part) for part in value.split("-"))
            return date(year, month, day)
        day_text, month_text, year_text = value.split()
        return date(int(year_text), _MONTHS[month_text.casefold()], int(day_text))
    except (KeyError, ValueError):
        return None


def _parse_amount(value: str) -> int | None:
    text = _CURRENCY_PATTERN.sub("", value).strip()
    if not text:
        return None

    suffix_match = re.search(r"\s*(CR|DR)\s*\Z", text, flags=re.IGNORECASE)
    suffix_sign: int | None = None
    if suffix_match:
        suffix_sign = 1 if suffix_match.group(1).upper() == "CR" else -1
        text = text[: suffix_match.start()].strip()

    parenthesized = text.startswith("(") and text.endswith(")")
    if text.startswith("(") != text.endswith(")"):
        return None
    if parenthesized:
        text = text[1:-1].strip()

    trailing_minus = text.endswith("-")
    if trailing_minus:
        text = text[:-1].strip()

    leading_sign = 1
    if text.startswith(("-", "+")):
        leading_sign = -1 if text[0] == "-" else 1
        text = text[1:].strip()

    negative_markers = int(parenthesized) + int(trailing_minus) + int(leading_sign < 0)
    if negative_markers > 1 or (suffix_sign is not None and negative_markers and suffix_sign > 0):
        return None
    if suffix_sign is not None and suffix_sign < 0 and leading_sign > 0 and not negative_markers:
        sign = -1
    elif suffix_sign is not None and suffix_sign > 0:
        sign = 1
    else:
        sign = -1 if negative_markers else 1

    text = "".join(" " if unicodedata.category(char) == "Zs" else char for char in text)
    if "," in text:
        integer_part, separator, fractional_part = text.partition(".")
        if not _GROUPED_COMMAS_PATTERN.fullmatch(integer_part):
            return None
        text = integer_part.replace(",", "")
        if separator:
            text += f".{fractional_part}"
    if " " in text:
        integer_part, separator, fractional_part = text.partition(".")
        if not _GROUPED_SPACES_PATTERN.fullmatch(integer_part):
            return None
        text = integer_part.replace(" ", "")
        if separator:
            text += f".{fractional_part}"
    if not _AMOUNT_PATTERN.fullmatch(text):
        return None

    try:
        quantized = Decimal(text).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        amount_minor = int(quantized * 100)
    except (InvalidOperation, ValueError):
        return None
    amount_minor *= sign
    if abs(amount_minor) > MAX_AMOUNT_MINOR:
        return None
    return amount_minor


def _looks_like_header(first_row: list[str]) -> bool:
    non_empty_cells = [cell for cell in first_row if cell]
    if not non_empty_cells:
        return False
    return all(
        _parse_date(cell, date_format) is None
        for cell in non_empty_cells
        for date_format in _DATE_FORMATS
    ) and all(_parse_amount(cell) is None for cell in non_empty_cells)


def _suggest_mapping(headers: list[str], has_header: bool) -> SuggestedMapping:
    aliases = {
        "date": {"date", "transaction date", "value date"},
        "description": {"description", "details", "narration", "particulars", "reference"},
        "amount": {"amount"},
        "debit": {"debit", "withdrawal", "money out"},
        "credit": {"credit", "deposit", "money in"},
    }
    matches: dict[str, int | None] = {key: None for key in aliases}
    if has_header:
        for index, header in enumerate(headers):
            normalized_header = header.casefold().strip()
            for key, names in aliases.items():
                if matches[key] is None and normalized_header in names:
                    matches[key] = index
    return SuggestedMapping(**matches)


def preview_response(
    preview_id: UUID,
    text: str,
    encoding: Literal["utf-8", "windows-1252"],
) -> tuple[ImportPreviewResponse, str]:
    """Validate the upload and prepare a display response and normalized Redis value."""
    delimiter, records, has_header_guess, row_count = _read_csv(text)
    headers = (
        records[0]
        if has_header_guess
        else [f"Column {index + 1}" for index in range(len(records[0]))]
    )
    data_rows = records[int(has_header_guess) :]
    normalized = io.StringIO(newline="")
    writer = csv.writer(normalized, delimiter=delimiter, lineterminator="\n")
    writer.writerows(records)
    return (
        ImportPreviewResponse(
            preview_id=preview_id,
            delimiter=delimiter,
            encoding=encoding,
            headers=headers,
            rows=data_rows[:MAX_PREVIEW_ROWS],
            row_count=row_count,
            suggested_mapping=_suggest_mapping(headers, has_header_guess),
            has_header_guess=has_header_guess,
        ),
        normalized.getvalue(),
    )


def decode_upload(content: bytes) -> tuple[str, Literal["utf-8", "windows-1252"]]:
    """Decode UTF-8 (with optional BOM), falling back to Windows-1252."""
    if b"\x00" in content:
        raise _not_csv()
    raw = content[3:] if content.startswith(b"\xef\xbb\xbf") else content
    try:
        return raw.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        try:
            return raw.decode("cp1252"), "windows-1252"
        except UnicodeDecodeError:
            raise _not_csv() from None


def _validate_mapping(payload: ImportParseRequest, column_count: int) -> dict[str, int | None]:
    raw = payload.mapping
    if not isinstance(raw, dict):
        raise _problem(422, "Invalid mapping", "The column mapping is invalid.", "invalid_mapping")

    valid_keys = {"date", "description", "amount", "debit", "credit"}
    if set(raw) - valid_keys or "date" not in raw:
        raise _problem(422, "Invalid mapping", "The column mapping is invalid.", "invalid_mapping")

    mapping: dict[str, int | None] = {}
    for key in valid_keys:
        value = raw.get(key)
        if value is None and key != "date":
            mapping[key] = None
            continue
        if (
            not isinstance(value, int)
            or isinstance(value, bool)
            or value < 0
            or value >= column_count
        ):
            raise _problem(
                422,
                "Invalid mapping",
                "Column indexes must be distinct zero-based indexes within the file.",
                "invalid_mapping",
            )
        mapping[key] = value

    expected_amount_columns = (
        mapping["amount"] is not None and mapping["debit"] is None and mapping["credit"] is None
        if payload.amount_mode == "signed"
        else mapping["amount"] is None
        and mapping["debit"] is not None
        and mapping["credit"] is not None
    )
    indexes = [index for index in mapping.values() if index is not None]
    if not expected_amount_columns or len(indexes) != len(set(indexes)):
        raise _problem(422, "Invalid mapping", "The column mapping is invalid.", "invalid_mapping")
    return mapping


@dataclass(frozen=True)
class _ParsedRow:
    row_index: int
    occurred_on: date | None
    note: str | None
    kind: CategoryKind | None
    amount_minor: int | None
    error: str | None
    import_hash: str | None = None
    suggested_category_id: UUID | None = None
    is_duplicate: bool = False

    def as_response(self) -> ImportParsedRow:
        return ImportParsedRow(
            row_index=self.row_index,
            date=self.occurred_on,
            note=self.note,
            kind=self.kind,
            amount_minor=self.amount_minor,
            suggested_category_id=self.suggested_category_id,
            is_duplicate=self.is_duplicate,
            error=self.error,
        )


def _row_transaction(
    row: list[str],
    row_index: int,
    mapping: dict[str, int | None],
    payload: ImportParseRequest,
    today: date,
) -> _ParsedRow:
    selected_indexes = [index for index in mapping.values() if index is not None]
    if any(index >= len(row) for index in selected_indexes):
        return _ParsedRow(row_index, None, None, None, None, "missing_column")

    note_index = mapping["description"]
    note = row[note_index].strip()[:280] or None if note_index is not None else None
    occurred_on = _parse_date(row[mapping["date"] or 0], payload.date_format)
    if occurred_on is None:
        return _ParsedRow(row_index, None, note, None, None, "invalid_date")
    if occurred_on < MIN_OCCURRED_ON or occurred_on > today + timedelta(days=1):
        return _ParsedRow(row_index, occurred_on, note, None, None, "date_out_of_range")

    if payload.amount_mode == "signed":
        amount_value = _parse_amount(row[mapping["amount"] or 0])
        if amount_value is None or amount_value == 0:
            return _ParsedRow(row_index, occurred_on, note, None, None, "invalid_amount")
        if payload.invert_sign:
            amount_value *= -1
        kind = CategoryKind.EXPENSE if amount_value < 0 else CategoryKind.INCOME
        amount_minor = abs(amount_value)
    else:
        debit_value = _parse_amount(row[mapping["debit"] or 0]) if row[mapping["debit"] or 0] else 0
        credit_value = (
            _parse_amount(row[mapping["credit"] or 0]) if row[mapping["credit"] or 0] else 0
        )
        if debit_value is None or credit_value is None:
            return _ParsedRow(row_index, occurred_on, note, None, None, "invalid_amount")
        debit_active = debit_value != 0
        credit_active = credit_value != 0
        if debit_active == credit_active:
            return _ParsedRow(row_index, occurred_on, note, None, None, "invalid_amount")
        kind = CategoryKind.EXPENSE if debit_active else CategoryKind.INCOME
        amount_minor = abs(debit_value if debit_active else credit_value)

    if amount_minor < 1 or amount_minor > MAX_AMOUNT_MINOR:
        return _ParsedRow(row_index, occurred_on, note, None, None, "invalid_amount")
    return _ParsedRow(row_index, occurred_on, note, kind, amount_minor, None)


def _parsed_file_rows(
    preview_text: str, payload: ImportParseRequest, today: date
) -> list[_ParsedRow]:
    _, records, _, _ = _read_csv(preview_text)
    mapping = _validate_mapping(payload, len(records[0]))
    data_records = records[int(payload.has_header) :]
    if len(data_records) > MAX_DATA_ROWS:
        raise _problem(
            422,
            "Too many rows",
            f"The CSV contains {len(data_records)} data rows; the maximum is {MAX_DATA_ROWS}.",
            "too_many_rows",
            extensions={"row_count": len(data_records)},
        )
    return [
        _row_transaction(row, index, mapping, payload, today)
        for index, row in enumerate(data_records, start=1)
    ]


def _hash_rows(user_id: UUID, account_id: UUID, rows: list[_ParsedRow]) -> list[_ParsedRow]:
    occurrences: defaultdict[tuple[date, CategoryKind, int, str], int] = defaultdict(int)
    hashed_rows: list[_ParsedRow] = []
    for row in rows:
        if row.error is not None or row.occurred_on is None or row.kind is None:
            hashed_rows.append(row)
            continue
        key = (row.occurred_on, row.kind, row.amount_minor or 0, row.note or "")
        occurrences[key] += 1
        digest_input = "|".join(
            (
                str(user_id),
                str(account_id),
                row.occurred_on.isoformat(),
                row.kind.value,
                str(row.amount_minor),
                row.note or "",
                str(occurrences[key]),
            )
        )
        hashed_rows.append(
            _ParsedRow(
                row.row_index,
                row.occurred_on,
                row.note,
                row.kind,
                row.amount_minor,
                row.error,
                hashlib.sha256(digest_input.encode("utf-8")).hexdigest(),
            )
        )
    return hashed_rows


def _assign_category_suggestions(
    rows: list[_ParsedRow],
    category_rows: list[tuple[str | None, CategoryKind, UUID, int]],
    default_category: Category | None,
) -> list[_ParsedRow]:
    most_common: dict[tuple[str | None, CategoryKind], tuple[UUID, int]] = {}
    for note, kind, used_category_id, count in category_rows:
        pair = (note, kind)
        current = most_common.get(pair)
        if (
            current is None
            or count > current[1]
            or (count == current[1] and used_category_id < current[0])
        ):
            most_common[pair] = (used_category_id, count)

    result: list[_ParsedRow] = []
    for row in rows:
        if row.error is not None or row.kind is None:
            result.append(row)
            continue
        suggested_category_id: UUID | None = most_common.get((row.note, row.kind), (None, 0))[0]
        if (
            suggested_category_id is None
            and default_category is not None
            and default_category.kind == row.kind
        ):
            suggested_category_id = default_category.id
        result.append(
            _ParsedRow(
                row.row_index,
                row.occurred_on,
                row.note,
                row.kind,
                row.amount_minor,
                row.error,
                row.import_hash,
                suggested_category_id,
                row.is_duplicate,
            )
        )
    return result


async def parse_import(
    session: AsyncSession,
    user_id: UUID,
    preview_text: str,
    payload: ImportParseRequest,
    now: datetime,
) -> ImportParseResponse:
    """Validate a mapping and produce per-row data, suggestions, and duplicate flags."""
    _, records, _, _ = _read_csv(preview_text)
    _validate_mapping(payload, len(records[0]))

    account = await accounts_service.read_account(session, user_id, payload.account_id)
    if account is None:
        raise _problem(422, "Invalid reference", "The account cannot be used.", "invalid_reference")
    if account.is_archived:
        raise _problem(422, "Archived reference", "The account is archived.", "archived_reference")

    default_category: Category | None = None
    if payload.default_category_id is not None:
        default_category = await categories_service.read_category(
            session, user_id, payload.default_category_id
        )
        if default_category is None:
            raise _problem(
                422,
                "Invalid reference",
                "The category cannot be used.",
                "invalid_reference",
            )
        if default_category.is_archived:
            raise _problem(
                422,
                "Archived reference",
                "The category is archived.",
                "archived_reference",
            )

    timezone = await users_service.read_timezone(session, user_id)
    today = local_today(now, timezone)
    parsed_rows = _parsed_file_rows(preview_text, payload, today)
    parsed_rows = _hash_rows(user_id, payload.account_id, parsed_rows)

    hashes = {row.import_hash for row in parsed_rows if row.import_hash is not None}
    duplicate_hashes = await repository.existing_import_hashes(session, user_id, hashes)
    parsed_rows = [
        _ParsedRow(
            row.row_index,
            row.occurred_on,
            row.note,
            row.kind,
            row.amount_minor,
            row.error,
            row.import_hash,
            row.suggested_category_id,
            row.import_hash in duplicate_hashes,
        )
        for row in parsed_rows
    ]

    category_pairs = {
        (row.note, row.kind) for row in parsed_rows if row.error is None and row.kind is not None
    }
    category_rows = list(await repository.category_usage(session, user_id, category_pairs))
    parsed_rows = _assign_category_suggestions(parsed_rows, category_rows, default_category)

    error_count = sum(row.error is not None for row in parsed_rows)
    duplicate_count = sum(row.is_duplicate for row in parsed_rows)
    return ImportParseResponse(
        items=[row.as_response() for row in parsed_rows],
        rows=len(parsed_rows),
        valid=len(parsed_rows) - error_count,
        errors=error_count,
        duplicates=duplicate_count,
    )


def commit_response(batch: ImportBatch) -> ImportCommitResponse:
    """Build the stable commit result stored with an import batch."""
    return ImportCommitResponse(
        batch_id=batch.id,
        imported_count=batch.imported_count,
        skipped_duplicate_count=batch.skipped_duplicate_count,
        skipped_by_user_count=batch.skipped_by_user_count,
        error_count=batch.error_count,
        errors=[ImportRowError.model_validate(error) for error in batch.errors],
    )


async def read_idempotent_result(
    session: AsyncSession, user_id: UUID, idempotency_key: str
) -> ImportCommitResponse | None:
    batch = await repository.get_import_batch_by_key(session, user_id, idempotency_key)
    return None if batch is None else commit_response(batch)


async def commit_import(
    session: AsyncSession,
    user_id: UUID,
    idempotency_key: str,
    preview_text: str,
    payload: ImportCommitRequest,
    now: datetime,
) -> tuple[ImportCommitResponse, bool]:
    """Reparse and atomically insert one import batch; return False on an idempotent replay."""
    await repository.lock_idempotency_key(session, user_id, idempotency_key)
    existing = await repository.get_import_batch_by_key(session, user_id, idempotency_key)
    if existing is not None:
        return commit_response(existing), False

    account = await accounts_service.read_account(session, user_id, payload.account_id)
    if account is None:
        raise _problem(422, "Invalid reference", "The account cannot be used.", "invalid_reference")
    if account.is_archived:
        raise _problem(422, "Archived reference", "The account is archived.", "archived_reference")

    parse_payload = ImportParseRequest(
        account_id=payload.account_id,
        mapping=payload.mapping,
        date_format=payload.date_format,
        amount_mode=payload.amount_mode,
        invert_sign=payload.invert_sign,
        has_header=payload.has_header,
    )
    _, records, _, _ = _read_csv(preview_text)
    _validate_mapping(parse_payload, len(records[0]))
    timezone = await users_service.read_timezone(session, user_id)
    parsed_rows = _parsed_file_rows(preview_text, parse_payload, local_today(now, timezone))

    choices = {choice.row_index: choice for choice in payload.rows}
    if any(row_index > len(parsed_rows) for row_index in choices):
        raise _problem(
            422,
            "Invalid row choice",
            "A row choice refers to a row that does not exist in the CSV.",
            "invalid_row_choice",
        )

    skipped_by_user_count = 0
    chosen_rows: list[_ParsedRow] = []
    for row in parsed_rows:
        row_choice = choices.get(row.row_index)
        if row_choice is not None and row_choice.skip:
            skipped_by_user_count += 1
        if row.error is None and row.kind is not None and row_choice is not None:
            row = _ParsedRow(
                row.row_index,
                row.occurred_on,
                row.note,
                row_choice.kind or row.kind,
                row.amount_minor,
                row.error,
            )
        chosen_rows.append(row)

    hashed_rows = _hash_rows(user_id, payload.account_id, chosen_rows)
    category_ids = {
        choice.category_id
        for row_index, choice in choices.items()
        if choice.category_id is not None
        and row_index <= len(parsed_rows)
        and not choice.skip
        and parsed_rows[row_index - 1].error is None
    }
    categories = await repository.categories_by_id(session, user_id, category_ids)
    hashes = {
        row.import_hash
        for row in hashed_rows
        if row.import_hash is not None
        and not (choices.get(row.row_index) and choices[row.row_index].skip)
    }
    existing_hashes = await repository.existing_import_hashes(session, user_id, hashes)

    errors: list[ImportRowError] = []
    transactions: list[dict[str, object]] = []
    skipped_duplicate_count = 0
    error_count = 0
    for row in hashed_rows:
        choice: ImportRowChoice | None = choices.get(row.row_index)
        if choice is not None and choice.skip:
            continue
        if row.error is not None or row.occurred_on is None or row.kind is None:
            errors.append(ImportRowError(row_index=row.row_index, code=row.error or "invalid_row"))
            error_count += 1
            continue

        category_id = choice.category_id if choice is not None else None
        if category_id is not None:
            category = categories.get(category_id)
            code: str | None = None
            if category is None or category.deleted_at is not None:
                code = "invalid_reference"
            elif category.is_archived:
                code = "archived_reference"
            elif category.kind != row.kind:
                code = "kind_mismatch"
            if code is not None:
                errors.append(ImportRowError(row_index=row.row_index, code=code))
                error_count += 1
                continue

        if row.import_hash in existing_hashes:
            errors.append(ImportRowError(row_index=row.row_index, code="duplicate"))
            skipped_duplicate_count += 1
            continue
        if row.import_hash is None:
            raise RuntimeError("Parsed import row has no import hash")
        transactions.append(
            {
                "id": new_uuid7(),
                "user_id": user_id,
                "account_id": payload.account_id,
                "category_id": category_id,
                "kind": row.kind,
                "amount_minor": row.amount_minor,
                "currency": "GHS",
                "occurred_on": row.occurred_on,
                "note": row.note,
                "import_hash": row.import_hash,
                "import_batch_id": None,
            }
        )

    batch_id = new_uuid7()
    for transaction in transactions:
        transaction["import_batch_id"] = batch_id
    batch = ImportBatch(
        id=batch_id,
        user_id=user_id,
        account_id=payload.account_id,
        idempotency_key=idempotency_key,
        imported_count=len(transactions),
        skipped_duplicate_count=skipped_duplicate_count,
        skipped_by_user_count=skipped_by_user_count,
        error_count=error_count,
        errors=[error.model_dump() for error in errors],
    )
    await repository.add_import_batch(session, batch)
    await repository.add_transactions(session, transactions)
    return commit_response(batch), True


async def undo_import_batch(
    session: AsyncSession, user_id: UUID, batch_id: UUID, now: datetime
) -> bool:
    """Soft-delete every transaction in an owned batch, once."""
    return await repository.undo_import_batch(session, user_id, batch_id, now)


async def list_import_batches(
    session: AsyncSession,
    user_id: UUID,
    *,
    limit: int,
    cursor: str | None,
    signing_keys: Sequence[bytes],
) -> tuple[list[ImportBatchRead], str | None]:
    decoded = decode_cursor(cursor, signing_keys) if cursor is not None else None
    rows = await repository.list_import_batches(
        session,
        user_id,
        limit=limit + 1,
        cursor_created_at=None if decoded is None else decoded.created_at,
        cursor_id=None if decoded is None else decoded.row_id,
    )
    page = rows[:limit]
    next_cursor = None
    if len(rows) > limit:
        last = page[-1]
        next_cursor = encode_cursor(PageCursor(0, last.created_at, last.id), signing_keys)
    return (
        [
            ImportBatchRead(
                batch_id=batch.id,
                account_id=batch.account_id,
                imported_count=batch.imported_count,
                skipped_duplicate_count=batch.skipped_duplicate_count,
                skipped_by_user_count=batch.skipped_by_user_count,
                error_count=batch.error_count,
                created_at=batch.created_at,
                undone_at=batch.undone_at,
            )
            for batch in page
        ],
        next_cursor,
    )
