"""Dashboard response models."""

from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from largent.domain.daily_target import DailyStatus
from largent.modules.budgets.schemas import BudgetRead
from largent.modules.needs.models import NeedPriority
from largent.modules.transactions.schemas import TransactionRead


class DashboardWeek(BaseModel):
    start: date
    end: date
    income_minor: int
    spent_minor: int


class DashboardDailyTarget(BaseModel):
    target_minor: int | None
    spent_today_minor: int
    left_minor: int | None
    status: DailyStatus | None


class DashboardDay(BaseModel):
    date: date
    spent_minor: int


class DashboardNeed(BaseModel):
    id: UUID
    name: str
    target_minor: int
    priority: NeedPriority
    allocated_minor: int
    remaining_minor: int
    percent: int
    is_complete: bool


class DashboardNeeds(BaseModel):
    total_target_minor: int
    total_allocated_minor: int
    unallocated_savings_minor: int
    over_allocated: bool
    items: list[DashboardNeed]


class DashboardRead(BaseModel):
    total_balance_minor: int
    net_change_minor: int | None
    week: DashboardWeek
    daily_target: DashboardDailyTarget
    daily_breakdown: list[DashboardDay]
    budgets: list[BudgetRead]
    recent_transactions: list[TransactionRead]
    needs: DashboardNeeds


BalanceRange = Literal["all_time", "this_week", "this_month"]
