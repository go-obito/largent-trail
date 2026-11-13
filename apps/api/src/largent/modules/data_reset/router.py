"""Authenticated financial-data reset endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.clock import utc_now
from largent.core.tenancy import get_current_user_id, get_tenant_session
from largent.modules.accounts.models import Account
from largent.modules.budgets.models import Budget
from largent.modules.categories.models import Category
from largent.modules.needs.models import Need
from largent.modules.transactions.models import Transaction

router = APIRouter()

CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]


async def _soft_delete(session: AsyncSession, model: type, user_id: UUID, now) -> None:
    """Soft-delete every active row owned by this user."""
    await session.execute(
        update(model)
        .where(model.user_id == user_id, model.deleted_at.is_(None))
        .values(deleted_at=now, updated_at=now)
    )


@router.delete("/activity", status_code=204)
async def reset_activity(user_id: CurrentUserId, session: TenantSession) -> Response:
    """Clear ledger activity while preserving accounts, budgets, categories and priorities."""
    await _soft_delete(session, Transaction, user_id, utc_now())
    return Response(status_code=204)


@router.delete("/all", status_code=204)
async def reset_all_financial_data(user_id: CurrentUserId, session: TenantSession) -> Response:
    """Clear all financial setup and activity without touching the authenticated user."""
    now = utc_now()
    # Preserve soft-delete tombstones for sync while hiding all financial setup and activity.
    for model in (Transaction, Budget, Need, Category, Account):
        await _soft_delete(session, model, user_id, now)
    return Response(status_code=204)
