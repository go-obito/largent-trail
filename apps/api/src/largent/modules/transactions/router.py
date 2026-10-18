"""Authenticated transaction HTTP endpoints."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.clock import utc_now
from largent.core.errors import ProblemHTTPException
from largent.core.pagination import DEFAULT_LIMIT, MAX_LIMIT, get_cursor_signing_keys
from largent.core.tenancy import get_current_user_id, get_tenant_session
from largent.modules.transactions import service
from largent.modules.transactions.models import TransactionKind
from largent.modules.transactions.schemas import (
    TransactionCreate,
    TransactionPage,
    TransactionRead,
    TransactionUpdate,
)

router = APIRouter()

CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
CursorKeys = Annotated[list[bytes], Depends(get_cursor_signing_keys)]
Now = Annotated[datetime, Depends(utc_now)]


def _not_found() -> ProblemHTTPException:
    return ProblemHTTPException(
        status_code=404,
        title="Transaction not found",
        detail="The transaction was not found.",
        code="not_found",
    )


@router.get("", response_model=TransactionPage)
async def list_transactions(
    user_id: CurrentUserId,
    session: TenantSession,
    signing_keys: CursorKeys,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    cursor: str | None = None,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    account_id: UUID | None = None,
    category_id: UUID | None = None,
    kind: TransactionKind | None = None,
) -> TransactionPage:
    transactions, next_cursor = await service.list_transactions(
        session,
        user_id,
        limit=limit,
        cursor=cursor,
        date_from=date_from,
        date_to=date_to,
        account_id=account_id,
        category_id=category_id,
        kind=kind,
        signing_keys=signing_keys,
    )
    return TransactionPage(
        items=[TransactionRead.model_validate(item) for item in transactions],
        limit=limit,
        next_cursor=next_cursor,
    )


@router.post("", response_model=TransactionRead, status_code=201)
async def create_transaction(
    payload: TransactionCreate,
    response: Response,
    user_id: CurrentUserId,
    session: TenantSession,
    now: Now,
) -> TransactionRead:
    transaction, created = await service.create_transaction(session, user_id, payload, now)
    if not created:
        response.status_code = 200
    return TransactionRead.model_validate(transaction)


@router.get("/{transaction_id}", response_model=TransactionRead)
async def read_transaction(
    transaction_id: UUID, user_id: CurrentUserId, session: TenantSession
) -> TransactionRead:
    transaction = await service.read_transaction(session, user_id, transaction_id)
    if transaction is None:
        raise _not_found()
    return TransactionRead.model_validate(transaction)


@router.patch("/{transaction_id}", response_model=TransactionRead)
async def update_transaction(
    transaction_id: UUID,
    payload: TransactionUpdate,
    user_id: CurrentUserId,
    session: TenantSession,
    now: Now,
) -> TransactionRead:
    transaction = await service.update_transaction(session, user_id, transaction_id, payload, now)
    if transaction is None:
        raise _not_found()
    return TransactionRead.model_validate(transaction)


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: UUID, user_id: CurrentUserId, session: TenantSession
) -> Response:
    await service.delete_transaction(session, user_id, transaction_id)
    return Response(status_code=204)
