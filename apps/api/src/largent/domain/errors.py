"""Domain-level errors shared by tenant-owned modules."""

from __future__ import annotations

from typing import Literal

ConflictCode = Literal["duplicate_name", "id_conflict"]


class DomainConflict(Exception):
    """A requested mutation conflicts with existing data."""

    def __init__(self, code: ConflictCode) -> None:
        super().__init__(code)
        self.code = code
