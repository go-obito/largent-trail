"""Authenticated need HTTP endpoints."""

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
from largent.domain.needs import need_progress
from largent.modules.needs import service
from largent.modules.needs.link_import import (
    LinkImportFetchError,
    fetch_link_import_suggestion,
)
from largent.modules.needs.schemas import (
    AllocationCreate,
    AllocationPage,
    AllocationRead,
    AllocationResult,
    NeedCreate,
    NeedDeleteQuery,
    LinkImportPreviewRead,
    LinkImportPreviewRequest,
    NeedList,
    NeedOrder,
    NeedRead,
    NeedSummary,
    NeedUpdate,
)
from largent.modules.needs.service import NeedView

router = APIRouter()

CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
CursorKeys = Annotated[list[bytes], Depends(get_cursor_signing_keys)]
Now = Annotated[datetime, Depends(utc_now)]


def _not_found() -> ProblemHTTPException:
    return ProblemHTTPException(
        status_code=404,
        title="Need not found",
        detail="The need was not found.",
        code="not_found",
    )


def _read(view: NeedView) -> NeedRead:
    need = view.need
    remaining, percent, is_complete = need_progress(need.target_minor, view.allocated_minor)
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


@router.get("/summary", response_model=NeedSummary)
async def read_summary(user_id: CurrentUserId, session: TenantSession) -> NeedSummary:
    summary = await service.read_summary(session, user_id)
    return NeedSummary.model_validate(summary, from_attributes=True)


@router.post("/link-preview", response_model=LinkImportPreviewRead)
async def preview_need_link(payload: LinkImportPreviewRequest) -> LinkImportPreviewRead:
    """Fetch a bounded, best-effort product preview from a public web page."""
    try:
        suggestion = await fetch_link_import_suggestion(payload.url)
    except LinkImportFetchError as exc:
        messages = {
            "invalid_url": ("Invalid product link", "Enter a valid product page URL."),
            "url_not_allowed": (
                "Link not allowed",
                "This address cannot be fetched for security reasons.",
            ),
            "fetch_timeout": ("Link timed out", "The product page took too long to respond."),
            "site_blocked": (
                "Website blocked the request",
                "This website does not allow automated previews. Enter the details manually.",
            ),
            "not_a_product_page": (
                "Unsupported page",
                "The link did not return a product page.",
            ),
            "page_too_large": ("Page too large", "This product page is too large to preview."),
            "link_unavailable": (
                "Link unavailable",
                "The product page could not be reached. Try again or enter the details manually.",
            ),
        }
        title, detail = messages.get(
            exc.code,
            ("Link unavailable", "The product page could not be previewed."),
        )
        raise ProblemHTTPException(
            status_code=(
                422
                if exc.code in {"invalid_url", "url_not_allowed", "not_a_product_page", "page_too_large"}
                else 502
            ),
            title=title,
            detail=detail,
            code=exc.code,
        ) from None

    currency = suggestion.price_currency
    target_minor = suggestion.target_minor if currency == "GHS" else None
    return LinkImportPreviewRead(
        name=suggestion.name,
        target_minor=target_minor,
        price_minor=suggestion.target_minor,
        price_currency=currency,
    )


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


@router.post("/{need_id}/allocations", response_model=AllocationResult, status_code=201)
async def create_allocation(
    need_id: UUID,
    payload: AllocationCreate,
    response: Response,
    user_id: CurrentUserId,
    session: TenantSession,
) -> AllocationResult:
    result = await service.record_allocation(session, user_id, need_id, payload)
    if result is None:
        raise _not_found()
    view, summary, created = result
    if not created:
        response.status_code = 200
    return AllocationResult(
        need=_read(view), summary=NeedSummary.model_validate(summary, from_attributes=True)
    )


@router.get("/{need_id}/allocations", response_model=AllocationPage)
async def list_allocations(
    need_id: UUID,
    user_id: CurrentUserId,
    session: TenantSession,
    signing_keys: CursorKeys,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    cursor: str | None = None,
) -> AllocationPage:
    result = await service.list_allocations(
        session, user_id, need_id, limit=limit, cursor=cursor, signing_keys=signing_keys
    )
    if result is None:
        raise _not_found()
    rows, next_cursor = result
    return AllocationPage(
        items=[AllocationRead.model_validate(row) for row in rows],
        limit=limit,
        next_cursor=next_cursor,
    )


@router.delete("/{need_id}", status_code=204)
async def delete_need(
    need_id: UUID,
    user_id: CurrentUserId,
    session: TenantSession,
    now: Now,
    query: Annotated[NeedDeleteQuery, Query()],
) -> Response:
    await service.delete_need(session, user_id, need_id, query, now)
    return Response(status_code=204)
