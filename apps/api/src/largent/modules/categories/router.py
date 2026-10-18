"""Authenticated category HTTP endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.errors import ProblemHTTPException
from largent.core.pagination import DEFAULT_LIMIT, MAX_LIMIT, get_cursor_signing_keys
from largent.core.tenancy import get_current_user_id, get_tenant_session
from largent.modules.categories import service
from largent.modules.categories.models import CategoryKind
from largent.modules.categories.schemas import (
    CategoryCreate,
    CategoryPage,
    CategoryRead,
    CategoryUpdate,
)

router = APIRouter()

CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
CursorKeys = Annotated[list[bytes], Depends(get_cursor_signing_keys)]


def _not_found() -> ProblemHTTPException:
    return ProblemHTTPException(
        status_code=404,
        title="Category not found",
        detail="The category was not found.",
        code="not_found",
    )


@router.get("", response_model=CategoryPage)
async def list_categories(
    user_id: CurrentUserId,
    session: TenantSession,
    signing_keys: CursorKeys,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    cursor: str | None = None,
    include_archived: bool = False,
    kind: CategoryKind | None = None,
) -> CategoryPage:
    categories, next_cursor = await service.list_categories(
        session,
        user_id,
        limit=limit,
        cursor=cursor,
        include_archived=include_archived,
        kind=kind,
        signing_keys=signing_keys,
    )
    return CategoryPage(
        items=[CategoryRead.model_validate(category) for category in categories],
        limit=limit,
        next_cursor=next_cursor,
    )


@router.post("", response_model=CategoryRead, status_code=201)
async def create_category(
    payload: CategoryCreate, response: Response, user_id: CurrentUserId, session: TenantSession
) -> CategoryRead:
    category, created = await service.create_category(session, user_id, payload)
    if not created:
        response.status_code = 200
    return CategoryRead.model_validate(category)


@router.get("/{category_id}", response_model=CategoryRead)
async def read_category(
    category_id: UUID, user_id: CurrentUserId, session: TenantSession
) -> CategoryRead:
    category = await service.read_category(session, user_id, category_id)
    if category is None:
        raise _not_found()
    return CategoryRead.model_validate(category)


@router.patch("/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: UUID, payload: CategoryUpdate, user_id: CurrentUserId, session: TenantSession
) -> CategoryRead:
    category = await service.update_category(
        session, user_id, category_id, payload.model_dump(exclude_unset=True)
    )
    if category is None:
        raise _not_found()
    return CategoryRead.model_validate(category)


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: UUID, user_id: CurrentUserId, session: TenantSession
) -> Response:
    await service.delete_category(session, user_id, category_id)
    return Response(status_code=204)
