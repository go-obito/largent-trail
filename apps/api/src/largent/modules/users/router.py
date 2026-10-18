"""Authenticated user profile endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.tenancy import get_current_user_id, get_tenant_session
from largent.modules.users import service
from largent.modules.users.schemas import UserRead, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserRead)
async def get_me(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_session)],
) -> UserRead:
    user = await service.read_profile(session, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found.")
    return UserRead.model_validate(user)


@router.patch("/me", response_model=UserRead)
async def patch_me(
    payload: UserUpdate,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    session: Annotated[AsyncSession, Depends(get_tenant_session)],
) -> UserRead:
    user = await service.update_profile(session, user_id, payload.model_dump(exclude_unset=True))
    if user is None:
        raise HTTPException(status_code=404, detail="User profile not found.")
    return UserRead.model_validate(user)
