"""Configuration validation tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError
from tests.conftest import make_settings

from largent.core.config import Settings


def test_missing_required_setting_fails() -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_cors_wildcard_is_rejected() -> None:
    with pytest.raises(ValidationError):
        make_settings(cors_allowed_origins=["*"])
