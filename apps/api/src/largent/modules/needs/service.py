"""Need use cases."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.ids import new_uuid7
from largent.domain.errors import DomainConflict, DomainRuleViolation
from largent.domain.needs import MAX_ACTIVE_NEEDS, PRIORITY_RANK, place_need
from largent.modules.needs import repository
from largent.modules.needs.models import Need
from largent.modules.needs.schemas import NeedCreate, NeedUpdate


@dataclass(frozen=True, slots=True)
class NeedView:
    """A need with the amount allocated to it, derived from the ledger and never stored."""

    need: Need
    allocated_minor: int


def _replay(existing: Need, values: dict[str, object]) -> tuple[Need, bool]:
    """Return the existing row for an identical payload; anything else is an id conflict."""
    if existing.deleted_at is None and all(getattr(existing, k) == v for k, v in values.items()):
        return existing, False
    raise DomainConflict("id_conflict")


async def _allocated_by_need(
    session: AsyncSession, user_id: UUID, need_ids: Sequence[UUID]
) -> dict[UUID, int]:
    """Allocated amount per need in one grouped query; nothing is allocated before the ledger."""
    return {}


async def _views(session: AsyncSession, user_id: UUID, needs: Sequence[Need]) -> list[NeedView]:
    if not needs:
        return []
    allocated = await _allocated_by_need(session, user_id, [need.id for need in needs])
    return [NeedView(need, allocated.get(need.id, 0)) for need in needs]


async def _renumber(session: AsyncSession, needs: Sequence[Need]) -> None:
    """Rewrite positions to 1..n in the given order."""
    for position, need in enumerate(needs, start=1):
        if need.position != position:
            need.position = position
    await session.flush()


def _in_order(needs: Sequence[Need], ids: Sequence[UUID]) -> list[Need]:
    by_id = {need.id: need for need in needs}
    return [by_id[need_id] for need_id in ids]


def _ranks(needs: Sequence[Need]) -> list[tuple[UUID, int]]:
    return [(need.id, PRIORITY_RANK[need.priority.value]) for need in needs]


async def create_need(
    session: AsyncSession, user_id: UUID, payload: NeedCreate
) -> tuple[NeedView, bool]:
    """Create a need idempotently by its client id; the flag is True when newly created."""
    need_id = payload.id or new_uuid7()
    values = payload.model_dump(exclude={"id"})
    existing = await repository.get_need(session, user_id, need_id, include_deleted=True)
    if existing is not None:
        need, created = _replay(existing, values)
        return (await _views(session, user_id, [need]))[0], created

    active = await repository.lock_active_needs(session, user_id)
    if len(active) >= MAX_ACTIVE_NEEDS:
        raise DomainRuleViolation("limit_reached", "id")

    rank = PRIORITY_RANK[payload.priority.value]
    order = place_need(_ranks(active), need_id, rank)
    need = Need(id=need_id, user_id=user_id, position=order.index(need_id) + 1, **values)
    try:
        async with session.begin_nested():
            await repository.add_need(session, need)
    except IntegrityError:
        existing = await repository.get_need(session, user_id, need_id, include_deleted=True)
        if existing is not None:
            replayed, created = _replay(existing, values)
            return (await _views(session, user_id, [replayed]))[0], created
        # The id may belong to another tenant; the response must not say so.
        raise DomainConflict("id_conflict") from None
    await _renumber(session, _in_order([*active, need], order))
    await session.refresh(need)
    return NeedView(need, 0), True


async def list_needs(session: AsyncSession, user_id: UUID) -> list[NeedView]:
    return await _views(session, user_id, await repository.list_needs(session, user_id))


async def read_need(session: AsyncSession, user_id: UUID, need_id: UUID) -> NeedView | None:
    need = await repository.get_need(session, user_id, need_id)
    return None if need is None else (await _views(session, user_id, [need]))[0]


async def update_need(
    session: AsyncSession, user_id: UUID, need_id: UUID, payload: NeedUpdate
) -> NeedView | None:
    active = await repository.lock_active_needs(session, user_id)
    need = next((n for n in active if n.id == need_id), None)
    if need is None:
        return None
    previous_priority = need.priority
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(need, field, value)
    await session.flush()
    if need.priority != previous_priority:
        order = place_need(_ranks(active), need.id, PRIORITY_RANK[need.priority.value])
        await _renumber(session, _in_order(active, order))
    await session.refresh(need)
    return (await _views(session, user_id, [need]))[0]


async def reorder_needs(
    session: AsyncSession, user_id: UUID, ids: Sequence[UUID]
) -> list[NeedView]:
    """Apply a complete manual order; it must match the active set exactly."""
    active = await repository.lock_active_needs(session, user_id)
    if len(ids) != len(active) or {n.id for n in active} != set(ids):
        raise DomainRuleViolation("invalid_order", "ids")
    ordered = _in_order(active, ids)
    await _renumber(session, ordered)
    for need in ordered:
        await session.refresh(need)
    return await _views(session, user_id, ordered)


async def delete_need(session: AsyncSession, user_id: UUID, need_id: UUID) -> None:
    """Soft delete and close the gap; a missing, foreign or deleted need is a no-op."""
    active = await repository.lock_active_needs(session, user_id)
    need = next((n for n in active if n.id == need_id), None)
    if need is None:
        return
    need.deleted_at = func.now()
    await session.flush()
    await _renumber(session, [n for n in active if n.id != need_id])
