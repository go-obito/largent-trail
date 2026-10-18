"""UUIDv7 helpers for client-synchronized rows."""

from __future__ import annotations

from typing import Annotated
from uuid import RFC_4122, UUID

from pydantic import AfterValidator
from uuid_utils import compat


def is_uuid7(value: object) -> bool:
    """Return whether a UUID or UUID string is an RFC 4122 UUIDv7."""
    if isinstance(value, UUID):
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = UUID(value)
        except ValueError:
            return False
    else:
        return False
    return parsed.version == 7 and parsed.variant == RFC_4122


def new_uuid7() -> UUID:
    """Generate a UUIDv7 using the project's uuid-utils dependency."""
    return compat.uuid7()


def _require_uuid7(value: UUID) -> UUID:
    if not is_uuid7(value):
        raise ValueError("id must be a UUIDv7")
    return value


ClientId = Annotated[UUID, AfterValidator(_require_uuid7)]
