import type { components } from "@/lib/api/schema";
import { addDaysToDate } from "@/lib/date";
import { todayInTz, weekStart } from "@/lib/dates";

type BudgetPeriod = components["schemas"]["BudgetPeriod"];
type BudgetStatus = components["schemas"]["BudgetRead"]["status"];
type BudgetRead = components["schemas"]["BudgetRead"];

const statusRanks: Record<BudgetStatus, number> = {
  within: 0,
  near_limit: 1,
  over_limit: 2,
};

const statusLabels: Record<BudgetStatus, string> = {
  within: "On track",
  near_limit: "Near limit",
  over_limit: "Over budget",
};

export function budgetPercent(spent: number, limit: number): number {
  return limit > 0 ? Math.floor((spent * 100) / limit) : 0;
}

export function statusRank(status: BudgetStatus): number {
  return statusRanks[status];
}

export function statusLabel(status: BudgetStatus): string {
  return statusLabels[status];
}

export function budgetsNeedingAttention(
  budgets: BudgetRead[],
): BudgetRead[] {
  return budgets.filter(
    (budget) => !budget.is_archived && budget.status !== "within",
  );
}

export function periodRange(
  period: BudgetPeriod,
  timezone: string,
): { from: string; to: string } {
  const today = todayInTz(timezone);

  if (period === "weekly") {
    const from = weekStart(today);
    return { from, to: addDaysToDate(from, 6) };
  }

  const [year, month] = today.split("-").map(Number);
  const from = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-01`;
  const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

  return { from, to };
}
