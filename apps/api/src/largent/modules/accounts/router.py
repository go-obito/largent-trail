"""Authenticated account HTTP endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.errors import ProblemHTTPException
from largent.core.pagination import DEFAULT_LIMIT, MAX_LIMIT, get_cursor_signing_keys
from largent.core.tenancy import get_current_user_id, get_tenant_session
from largent.modules.accounts import service
from largent.modules.accounts.schemas import AccountCreate, AccountPage, AccountRead, AccountUpdate

router = APIRouter()

CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
CursorKeys = Annotated[list[bytes], Depends(get_cursor_signing_keys)]


def _not_found() -> ProblemHTTPException:
    return ProblemHTTPException(
        status_code=404,
        title="Account not found",
        detail="The account was not found.",
        code="not_found",
    )


@router.get("", response_model=AccountPage)
async def list_accounts(
    user_id: CurrentUserId,
    session: TenantSession,
    signing_keys: CursorKeys,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    cursor: str | None = None,
    include_archived: bool = False,
) -> AccountPage:
    accounts, next_cursor = await service.list_accounts(
        session,
        user_id,
        limit=limit,
        cursor=cursor,
        include_archived=include_archived,
        signing_keys=signing_keys,
    )
    return AccountPage(
        items=[AccountRead.model_validate(account) for account in accounts],
        limit=limit,
        next_cursor=next_cursor,
    )


@router.post("", response_model=AccountRead, status_code=201)
async def create_account(
    payload: AccountCreate, response: Response, user_id: CurrentUserId, session: TenantSession
) -> AccountRead:
    account, created = await service.create_account(session, user_id, payload)
    if not created:
        response.status_code = 200
    return AccountRead.model_validate(account)


@router.get("/{account_id}", response_model=AccountRead)
async def read_account(
    account_id: UUID, user_id: CurrentUserId, session: TenantSession
) -> AccountRead:
    account = await service.read_account(session, user_id, account_id)
    if account is None:
        raise _not_found()
    return AccountRead.model_validate(account)


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: UUID, payload: AccountUpdate, user_id: CurrentUserId, session: TenantSession
) -> AccountRead:
    account = await service.update_account(
        session, user_id, account_id, payload.model_dump(exclude_unset=True)
    )
    if account is None:
        raise _not_found()
    return AccountRead.model_validate(account)


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: UUID, user_id: CurrentUserId, session: TenantSession
) -> Response:
    await service.delete_account(session, user_id, account_id)
    return Response(status_code=204)
