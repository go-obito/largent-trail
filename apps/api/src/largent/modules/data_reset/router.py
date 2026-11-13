"""Authenticated financial-data reset endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.clock import utc_now
from largent.core.tenancy import get_current_user_id, get_tenant_session
from largent.modules.accounts.models import Account
from largent.modules.budgets.models import Budget
from largent.modules.categories.models import Category
from largent.modules.imports.models import ImportBatch
from largent.modules.needs.models import Need
from largent.modules.transactions.models import Transaction
from largent.modules.users.models import User

router = APIRouter()

CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]


async def _soft_delete(
    session: AsyncSession,
    model: type[Transaction | Budget | Need | Category | Account],
    user_id: UUID,
    now: datetime,
) -> None:
    """Soft-delete every active row owned by this user."""
    await session.execute(
        update(model)
        .where(model.user_id == user_id, model.deleted_at.is_(None))
        .values(deleted_at=now, updated_at=now)
    )


async def _invalidate_import_previews(redis: Redis, user_id: UUID) -> None:
    """Remove only this tenant's temporary uploaded-statement previews."""
    keys = [
        key async for key in redis.scan_iter(match=f"import:{user_id}:*", count=100)
    ]
    if keys:
        await redis.delete(*keys)


@router.delete("/activity", status_code=204)
async def reset_activity(user_id: CurrentUserId, session: TenantSession) -> Response:
    """Clear ledger activity while preserving accounts, budgets, categories and priorities."""
    await _soft_delete(session, Transaction, user_id, utc_now())
    return Response(status_code=204)


@router.delete("/all", status_code=204)
async def reset_all_financial_data(
    user_id: CurrentUserId,
    session: TenantSession,
    request: Request,
) -> Response:
    """Reset active financial data and redact import metadata without touching the user."""
    now = utc_now()
    for model in (Transaction, Budget, Need, Category, Account):
        await _soft_delete(session, model, user_id, now)

    # Detach transaction tombstones from import batches, then remove the tenant's
    # import history. The composite FK uses MATCH SIMPLE, so NULL batch IDs are valid.
    await session.execute(
        update(Transaction)
        .where(Transaction.user_id == user_id, Transaction.import_batch_id.is_not(None))
        .values(import_batch_id=None)
    )
    await session.execute(delete(ImportBatch).where(ImportBatch.user_id == user_id))

    # Remove temporary statement contents before the endpoint completes.
    await _invalidate_import_previews(request.app.state.redis, user_id)

    # Re-enable first-run defaults without changing the user profile or auth identity.
    await session.execute(update(User).where(User.id == user_id).values(defaults_seeded_at=None))
    return Response(status_code=204)
