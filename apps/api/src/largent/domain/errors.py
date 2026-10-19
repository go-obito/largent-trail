"""Domain-level errors shared by tenant-owned modules."""

from __future__ import annotations

from typing import Literal

ConflictCode = Literal["duplicate_name", "duplicate_budget", "id_conflict"]
RuleCode = Literal["invalid_reference", "archived_reference", "kind_mismatch", "invalid_date"]


class DomainConflict(Exception):
    """A requested mutation conflicts with existing data."""

    def __init__(self, code: ConflictCode) -> None:
        super().__init__(code)
        self.code = code


class DomainRuleViolation(Exception):
    """A well-formed request that breaks a business rule; `field` names the offending input."""

    def __init__(self, code: RuleCode, field: str) -> None:
        super().__init__(code)
        self.code = code
        self.field = field
