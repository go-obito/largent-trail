"""Need use cases."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.ids import new_uuid7
from largent.core.pagination import build_created_page, decode_cursor
from largent.domain.errors import DomainConflict, DomainRuleViolation
from largent.domain.money import account_balance
from largent.domain.needs import (
    MAX_ACTIVE_NEEDS,
    PRIORITY_RANK,
    need_progress,
    place_need,
    unallocated,
)
from largent.domain.transaction_rules import local_today
from largent.modules.accounts import service as accounts_service
from largent.modules.needs import repository
from largent.modules.needs.models import AllocationKind, Need, NeedAllocation
from largent.modules.needs.schemas import (
    AllocationCreate,
    NeedCreate,
    NeedDeleteQuery,
    NeedUpdate,
)
from largent.modules.transactions import service as transactions_service
from largent.modules.transactions.models import TransactionKind
from largent.modules.transactions.schemas import TransactionCreate
from largent.modules.users import service as users_service


@dataclass(frozen=True, slots=True)
class NeedView:
    """A need with the amount allocated to it, derived from the ledger and never stored."""

    need: Need
    allocated_minor: int


@dataclass(frozen=True, slots=True)
class SummaryView:
    savings_pool_minor: int
    total_allocated_minor: int
    unallocated_minor: int
    over_allocated: bool
    total_target_minor: int
    total_remaining_minor: int


def _replay(existing: Need, values: dict[str, object]) -> tuple[Need, bool]:
    """Return the existing row for an identical payload; anything else is an id conflict."""
    if existing.deleted_at is None and all(getattr(existing, k) == v for k, v in values.items()):
        return existing, False
    raise DomainConflict("id_conflict")


async def _allocated_by_need(
    session: AsyncSession, user_id: UUID, need_ids: Sequence[UUID]
) -> dict[UUID, int]:
    """Allocated amount per need in one grouped query over the ledger."""
    return await repository.sum_allocated_by_need(session, user_id, need_ids)


async def _summary(
    session: AsyncSession, user_id: UUID, needs: Sequence[Need], allocated: dict[UUID, int]
) -> SummaryView:
    accounts = await accounts_service.pool_accounts(session, user_id)
    totals = await transactions_service.account_totals(session, user_id, list(accounts))
    pool = sum(
        account_balance(opening, *totals.get(account_id, (0, 0)))
        for account_id, opening in accounts.items()
    )
    total_allocated = sum(allocated.get(need.id, 0) for need in needs)
    free = unallocated(pool, total_allocated)
    remaining = sum(
        need_progress(need.target_minor, allocated.get(need.id, 0))[0] for need in needs
    )
    return SummaryView(
        savings_pool_minor=pool,
        total_allocated_minor=total_allocated,
        unallocated_minor=free,
        over_allocated=free < 0,
        total_target_minor=sum(need.target_minor for need in needs),
        total_remaining_minor=remaining,
    )


async def read_summary(session: AsyncSession, user_id: UUID) -> SummaryView:
    needs = await repository.list_needs(session, user_id)
    allocated = await _allocated_by_need(session, user_id, [need.id for need in needs])
    return await _summary(session, user_id, needs, allocated)


def _same_allocation(existing: NeedAllocation, need_id: UUID, payload: AllocationCreate) -> bool:
    return (
        existing.need_id == need_id
        and existing.kind == payload.kind
        and existing.amount_minor == payload.amount_minor
    )


async def record_allocation(
    session: AsyncSession, user_id: UUID, need_id: UUID, payload: AllocationCreate
) -> tuple[NeedView, SummaryView, bool] | None:
    """Append a ledger row idempotently; None when the need is missing, flag True when new."""
    await repository.lock_user(session, user_id)
    need = await repository.get_need(session, user_id, need_id)
    if need is None:
        return None
    allocation_id = payload.id or new_uuid7()
    existing = await repository.get_allocation(session, user_id, allocation_id)
    created = existing is None
    if existing is not None and not _same_allocation(existing, need_id, payload):
        raise DomainConflict("id_conflict")

    if created:
        active = await repository.list_needs(session, user_id)
        allocated = await _allocated_by_need(session, user_id, [n.id for n in active])
        current = allocated.get(need_id, 0)
        if payload.kind is AllocationKind.ALLOCATE:
            summary = await _summary(session, user_id, active, allocated)
            if payload.amount_minor > summary.unallocated_minor:
                raise DomainRuleViolation("insufficient_unallocated", "amount_minor")
            if payload.amount_minor > need_progress(need.target_minor, current)[0]:
                raise DomainRuleViolation("exceeds_target", "amount_minor")
        elif payload.amount_minor > current:
            raise DomainRuleViolation("exceeds_allocated", "amount_minor")
        allocation = NeedAllocation(
            id=allocation_id,
            user_id=user_id,
            need_id=need_id,
            kind=payload.kind,
            amount_minor=payload.amount_minor,
        )
        try:
            async with session.begin_nested():
                await repository.add_allocation(session, allocation)
        except IntegrityError:
            # The id may belong to another tenant; the response must not say so.
            raise DomainConflict("id_conflict") from None

    active = await repository.list_needs(session, user_id)
    allocated = await _allocated_by_need(session, user_id, [n.id for n in active])
    summary = await _summary(session, user_id, active, allocated)
    return NeedView(need, allocated.get(need_id, 0)), summary, created


async def list_allocations(
    session: AsyncSession,
    user_id: UUID,
    need_id: UUID,
    *,
    limit: int,
    cursor: str | None,
    signing_keys: Sequence[bytes],
) -> tuple[list[NeedAllocation], str | None] | None:
    if await repository.get_need(session, user_id, need_id) is None:
        return None
    decoded = decode_cursor(cursor, signing_keys) if cursor is not None else None
    rows = await repository.list_allocations(
        session, user_id, need_id, limit=limit + 1, cursor=decoded
    )
    return build_created_page(rows, limit, signing_keys)


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


async def delete_need(
    session: AsyncSession,
    user_id: UUID,
    need_id: UUID,
    query: NeedDeleteQuery,
    now: datetime,
) -> None:
    """Reconcile outstanding savings, soft delete, and close the position gap."""
    await repository.lock_user(session, user_id)
    active = await repository.lock_active_needs(session, user_id)
    need = next((n for n in active if n.id == need_id), None)
    if need is None:
        return

    allocated = (await _allocated_by_need(session, user_id, [need_id])).get(need_id, 0)
    if allocated > 0:
        if query.reconcile is None:
            raise DomainConflict(
                "allocation_outstanding", extensions={"allocated_minor": allocated}
            )

        await repository.add_allocation(
            session,
            NeedAllocation(
                id=new_uuid7(),
                user_id=user_id,
                need_id=need_id,
                kind=AllocationKind.RELEASE,
                amount_minor=allocated,
            ),
        )

        if query.reconcile == "purchased":
            timezone = await users_service.read_timezone(session, user_id)
            transaction = TransactionCreate(
                account_id=query.account_id,
                category_id=query.category_id,
                kind=TransactionKind.EXPENSE,
                amount_minor=allocated,
                occurred_on=query.occurred_on or local_today(now, timezone),
                note=need.name,
            )
            await transactions_service.create_transaction(session, user_id, transaction, now)

    need.deleted_at = func.now()
    await session.flush()
    await _renumber(session, [n for n in active if n.id != need_id])
