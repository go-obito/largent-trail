"""Shared text normalization for user-provided string fields."""

from __future__ import annotations

import unicodedata


def normalize_text(value: object) -> object:
    """NFC-normalize and trim strings; pass other types through for Pydantic to reject."""
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value).strip()
    return value
