"""Validated CSV import request and response models."""

from __future__ import annotations

from datetime import date as Date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool

from largent.modules.categories.models import CategoryKind

DateFormat = Literal["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY", "D MMM YYYY"]
AmountMode = Literal["signed", "debit_credit"]

# Pydantic's JSON schema is intentionally a dynamic JSON object.
_MAPPING_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["date"],
    "additionalProperties": False,
    "properties": {
        "date": {
            "type": "integer",
            "minimum": 0,
            "description": "Zero-based index of the date column.",
            "examples": [0],
        },
        "description": {
            "type": ["integer", "null"],
            "minimum": 0,
            "description": "Optional zero-based index of the description column.",
            "examples": [1, None],
        },
        "amount": {
            "type": ["integer", "null"],
            "minimum": 0,
            "description": "Zero-based amount column index for signed mode.",
            "examples": [2, None],
        },
        "debit": {
            "type": ["integer", "null"],
            "minimum": 0,
            "description": "Zero-based debit column index for debit_credit mode.",
            "examples": [2, None],
        },
        "credit": {
            "type": ["integer", "null"],
            "minimum": 0,
            "description": "Zero-based credit column index for debit_credit mode.",
            "examples": [3, None],
        },
    },
    "examples": [
        {"date": 0, "description": 1, "amount": 2},
        {"date": 0, "description": 1, "debit": 2, "credit": 3},
    ],
}


class ImportParseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    account_id: UUID = Field(description="Active account that will own imported transactions.")
    mapping: object = Field(
        description=(
            "Column indexes are zero-based and refer to positions, never header text. "
            "Indexes must be distinct and in range; description is optional. Use amount "
            "for signed mode, or debit and credit for debit_credit mode."
        ),
        examples=[{"date": 0, "description": 1, "amount": 2}],
        json_schema_extra=_MAPPING_SCHEMA,
    )
    date_format: DateFormat = Field(
        default="DD/MM/YYYY",
        description=(
            "Strict date format; dates are never guessed between day-first and month-first."
        ),
        examples=["DD/MM/YYYY", "YYYY-MM-DD"],
    )
    amount_mode: AmountMode = Field(
        description="Signed amounts infer kind from sign; debit_credit uses the selected column.",
        examples=["signed", "debit_credit"],
    )
    invert_sign: StrictBool = Field(
        default=False,
        description="Flip signed-mode amounts when the source records expenses as positive.",
    )
    default_category_id: UUID | None = Field(
        default=None,
        description="Fallback category for valid rows when no usage-based suggestion exists.",
    )
    has_header: StrictBool = Field(
        default=True,
        description=(
            "Whether to skip the first CSV row as headers. Defaults to true; set false to "
            "import it as data. When false, preview display headers are synthetic."
        ),
    )


class SuggestedMapping(BaseModel):
    date: int | None = Field(
        description="Zero-based date column index guessed from the header.", examples=[0, None]
    )
    description: int | None = Field(
        description="Zero-based description column index guessed from the header.",
        examples=[1, None],
    )
    amount: int | None = Field(
        description="Zero-based signed amount column index, if found.", examples=[2, None]
    )
    debit: int | None = Field(
        description="Zero-based debit column index, if found.", examples=[2, None]
    )
    credit: int | None = Field(
        description="Zero-based credit column index, if found.", examples=[3, None]
    )


class ImportPreviewResponse(BaseModel):
    preview_id: UUID = Field(description="User-scoped identifier for the temporary preview.")
    delimiter: str = Field(description="Detected CSV delimiter: comma, semicolon, tab, or pipe.")
    encoding: Literal["utf-8", "windows-1252"] = Field(
        description="Detected source text encoding after UTF-8 BOM removal."
    )
    headers: list[str] = Field(
        description="Display labels only; column identity always uses zero-based indexes."
    )
    rows: list[list[str]] = Field(description="Up to the first 20 data rows.")
    row_count: int = Field(description="Number of data rows, excluding a guessed header.")
    suggested_mapping: SuggestedMapping = Field(
        description="Header-name guesses expressed as zero-based column indexes."
    )
    has_header_guess: bool = Field(
        description="True when the first row looks like labels; parse may override this guess."
    )


class ImportParsedRow(BaseModel):
    row_index: int = Field(description="One-based data-row index, excluding the selected header.")
    date: Date | None = Field(description="Parsed date, or null when the row has no valid date.")
    note: str | None = Field(description="Trimmed description, capped at 280 characters.")
    kind: CategoryKind | None = Field(description="Income or expense inferred from the amount.")
    amount_minor: int | None = Field(description="Positive integer amount in pesewas.")
    suggested_category_id: UUID | None = Field(
        description="Active matching-kind category suggestion, if one is available."
    )
    is_duplicate: bool = Field(
        description="Whether an active transaction already has this import hash."
    )
    error: str | None = Field(
        description="Row error code, or null for a valid row.",
        examples=["invalid_date", "invalid_amount", "date_out_of_range", "missing_column", None],
    )


class ImportParseResponse(BaseModel):
    items: list[ImportParsedRow] = Field(description="Parsed rows in original file order.")
    rows: int = Field(description="Total number of data rows processed.")
    valid: int = Field(description="Rows without a parse error; duplicates are still valid.")
    errors: int = Field(description="Rows with a non-null row error.")
    duplicates: int = Field(description="Rows matching an active transaction import hash.")
