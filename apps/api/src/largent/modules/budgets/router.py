"""Authenticated budget HTTP endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.clock import utc_now
from largent.core.errors import ProblemHTTPException
from largent.core.pagination import DEFAULT_LIMIT, MAX_LIMIT, get_cursor_signing_keys
from largent.core.tenancy import get_current_user_id, get_tenant_session
from largent.modules.budgets import service
from largent.modules.budgets.schemas import BudgetCreate, BudgetPage, BudgetRead, BudgetUpdate
from largent.modules.budgets.service import BudgetView

router = APIRouter()

CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
CursorKeys = Annotated[list[bytes], Depends(get_cursor_signing_keys)]
Now = Annotated[datetime, Depends(utc_now)]


def _not_found() -> ProblemHTTPException:
    return ProblemHTTPException(
        status_code=404,
        title="Budget not found",
        detail="The budget was not found.",
        code="not_found",
    )


def _read(view: BudgetView) -> BudgetRead:
    budget = view.budget
    return BudgetRead.model_validate(
        {
            "id": budget.id,
            "category_id": budget.category_id,
            "period": budget.period,
            "limit_minor": budget.limit_minor,
            "currency": budget.currency,
            "is_archived": budget.is_archived,
            "spent_minor": view.spent_minor,
            "status": view.status,
            "created_at": budget.created_at,
            "updated_at": budget.updated_at,
        }
    )


@router.get("", response_model=BudgetPage)
async def list_budgets(
    user_id: CurrentUserId,
    session: TenantSession,
    signing_keys: CursorKeys,
    now: Now,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    cursor: str | None = None,
    include_archived: bool = False,
) -> BudgetPage:
    views, next_cursor = await service.list_budgets(
        session,
        user_id,
        limit=limit,
        cursor=cursor,
        include_archived=include_archived,
        now=now,
        signing_keys=signing_keys,
    )
    return BudgetPage(items=[_read(view) for view in views], limit=limit, next_cursor=next_cursor)


@router.post("", response_model=BudgetRead, status_code=201)
async def create_budget(
    payload: BudgetCreate,
    response: Response,
    user_id: CurrentUserId,
    session: TenantSession,
    now: Now,
) -> BudgetRead:
    view, created = await service.create_budget(session, user_id, payload, now)
    if not created:
        response.status_code = 200
    return _read(view)


@router.get("/{budget_id}", response_model=BudgetRead)
async def read_budget(
    budget_id: UUID, user_id: CurrentUserId, session: TenantSession, now: Now
) -> BudgetRead:
    view = await service.read_budget(session, user_id, budget_id, now)
    if view is None:
        raise _not_found()
    return _read(view)


@router.patch("/{budget_id}", response_model=BudgetRead)
async def update_budget(
    budget_id: UUID, payload: BudgetUpdate, user_id: CurrentUserId, session: TenantSession, now: Now
) -> BudgetRead:
    view = await service.update_budget(session, user_id, budget_id, payload, now)
    if view is None:
        raise _not_found()
    return _read(view)


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: UUID, user_id: CurrentUserId, session: TenantSession
) -> Response:
    await service.delete_budget(session, user_id, budget_id)
    return Response(status_code=204)
