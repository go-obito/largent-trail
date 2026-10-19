"""Pure rules for the prioritized needs list."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

MAX_ACTIVE_NEEDS = 200
PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


def place_need(current: Sequence[tuple[UUID, int]], need_id: UUID, rank: int) -> list[UUID]:
    """Order IDs with `need_id` after the last other need of equal or higher priority.

    `current` is the ordered `(id, rank)` list and may or may not contain `need_id`.
    """
    others = [(item_id, item_rank) for item_id, item_rank in current if item_id != need_id]
    index = 0
    for offset, (_, item_rank) in enumerate(others):
        if item_rank <= rank:
            index = offset + 1
    ids = [item_id for item_id, _ in others]
    ids.insert(index, need_id)
    return ids


def need_progress(target_minor: int, allocated_minor: int) -> tuple[int, int, bool]:
    """Return `(remaining_minor, percent, is_complete)`; any excess stays allocated."""
    remaining = max(0, target_minor - allocated_minor)
    percent = min(100, allocated_minor * 100 // target_minor)
    return remaining, percent, allocated_minor >= target_minor


def unallocated(savings_pool_minor: int, total_allocated_minor: int) -> int:
    """Savings not earmarked for any active need; negative means the pool is over-allocated."""
    return savings_pool_minor - total_allocated_minor
