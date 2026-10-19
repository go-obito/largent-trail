"""Dashboard endpoint."""
# mypy: ignore-errors

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from largent.core.clock import utc_now
from largent.core.tenancy import get_current_user_id, get_tenant_session
from largent.domain.needs import need_progress
from largent.modules.budgets.router import _read as budget_read
from largent.modules.reports import service
from largent.modules.reports.schemas import BalanceRange, DashboardRead
from largent.modules.transactions.schemas import TransactionRead

router = APIRouter()
CurrentUserId = Annotated[UUID, Depends(get_current_user_id)]
TenantSession = Annotated[AsyncSession, Depends(get_tenant_session)]
Now = Annotated[datetime, Depends(utc_now)]
DEFAULT_BALANCE_RANGE = Query("all_time")


@router.get("/dashboard", response_model=DashboardRead)
async def read_dashboard(
    user_id: CurrentUserId,
    session: TenantSession,
    now: Now,
    balance_range: BalanceRange = DEFAULT_BALANCE_RANGE,
) -> DashboardRead:
    data = await service.dashboard(session, user_id, now, balance_range)
    today = data["today"]
    if not isinstance(today, date):
        raise RuntimeError("Dashboard date is invalid")
    needs = []
    for need in data["needs"]:
        allocated = data["allocated"].get(need.id, 0)
        remaining, percent, complete = need_progress(need.target_minor, allocated)
        needs.append(
            {
                "id": need.id,
                "name": need.name,
                "target_minor": need.target_minor,
                "priority": need.priority,
                "allocated_minor": allocated,
                "remaining_minor": remaining,
                "percent": percent,
                "is_complete": complete,
            }
        )
    daily = data["daily"]
    return DashboardRead.model_validate(
        {
            "total_balance_minor": data["balance"],
            "net_change_minor": data["net_change"],
            "week": {
                "start": data["week_start"],
                "end": data["week_end"],
                "income_minor": data["income"],
                "spent_minor": data["spent"],
            },
            "daily_target": {
                "target_minor": daily.target_minor,
                "spent_today_minor": data["day_spend"].get(today, 0),
                "left_minor": daily.left_today_minor,
                "status": daily.status,
            },
            "daily_breakdown": [
                {
                    "date": data["week_start"] + timedelta(days=offset),
                    "spent_minor": data["day_spend"].get(
                        data["week_start"] + timedelta(days=offset), 0
                    )
                    if offset <= today.weekday()
                    else 0,
                }
                for offset in range(7)
            ],
            "budgets": [budget_read(view) for view in data["budget_views"]],
            "recent_transactions": [
                TransactionRead.model_validate(item) for item in data["recent"]
            ],
            "needs": {
                "total_target_minor": data["total_target"],
                "total_allocated_minor": data["total_allocated"],
                "unallocated_savings_minor": data["unallocated"],
                "over_allocated": data["unallocated"] < 0,
                "items": needs,
            },
        }
    )
