"""Authenticated need HTTP endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.errors import ProblemHTTPException
from largent.core.tenancy import get_current_user_id, get_tenant_session
from largent.domain.needs import progress
from largent.modules.needs import service
from largent.modules.needs.schemas import NeedCreate, NeedList, NeedOrder, NeedRead, NeedUpdate
from largent.modules.needs.service import NeedView

router = APIRouter()

CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]


def _not_found() -> ProblemHTTPException:
    return ProblemHTTPException(
        status_code=404,
        title="Need not found",
        detail="The need was not found.",
        code="not_found",
    )


def _read(view: NeedView) -> NeedRead:
    need = view.need
    remaining, percent, is_complete = progress(need.target_minor, view.allocated_minor)
    return NeedRead.model_validate(
        {
            "id": need.id,
            "name": need.name,
            "target_minor": need.target_minor,
            "priority": need.priority,
            "position": need.position,
            "note": need.note,
            "source_url": need.source_url,
            "allocated_minor": view.allocated_minor,
            "remaining_minor": remaining,
            "percent": percent,
            "is_complete": is_complete,
            "created_at": need.created_at,
            "updated_at": need.updated_at,
        }
    )


def _list(views: list[NeedView]) -> NeedList:
    return NeedList(items=[_read(view) for view in views])


@router.get("", response_model=NeedList)
async def list_needs(user_id: CurrentUserId, session: TenantSession) -> NeedList:
    return _list(await service.list_needs(session, user_id))


@router.post("", response_model=NeedRead, status_code=201)
async def create_need(
    payload: NeedCreate, response: Response, user_id: CurrentUserId, session: TenantSession
) -> NeedRead:
    view, created = await service.create_need(session, user_id, payload)
    if not created:
        response.status_code = 200
    return _read(view)


@router.put("/order", response_model=NeedList)
async def reorder_needs(
    payload: NeedOrder, user_id: CurrentUserId, session: TenantSession
) -> NeedList:
    return _list(await service.reorder_needs(session, user_id, payload.ids))


@router.get("/{need_id}", response_model=NeedRead)
async def read_need(need_id: UUID, user_id: CurrentUserId, session: TenantSession) -> NeedRead:
    view = await service.read_need(session, user_id, need_id)
    if view is None:
        raise _not_found()
    return _read(view)


@router.patch("/{need_id}", response_model=NeedRead)
async def update_need(
    need_id: UUID, payload: NeedUpdate, user_id: CurrentUserId, session: TenantSession
) -> NeedRead:
    view = await service.update_need(session, user_id, need_id, payload)
    if view is None:
        raise _not_found()
    return _read(view)


@router.delete("/{need_id}", status_code=204)
async def delete_need(need_id: UUID, user_id: CurrentUserId, session: TenantSession) -> Response:
    await service.delete_need(session, user_id, need_id)
    return Response(status_code=204)
