import type { components } from "@/lib/api/schema";

type DailyTargetStatus = Exclude<
  components["schemas"]["DashboardDailyTarget"]["status"],
  null
>;
type BudgetStatus = components["schemas"]["BudgetRead"]["status"];

export type StatusChip = {
  label: string;
  color: "success" | "warning" | "error";
};

export type BudgetProgressColor = "primary" | "warning" | "error";

const statusChips: Record<DailyTargetStatus, StatusChip> = {
  within_target: { label: "Within target", color: "success" },
  near_limit: { label: "Near limit", color: "warning" },
  over_target: { label: "Over target", color: "error" },
};

const budgetProgressColors: Record<BudgetStatus, BudgetProgressColor> = {
  within: "primary",
  near_limit: "warning",
  over_limit: "error",
};

export function statusToChip(status: DailyTargetStatus): StatusChip {
  return statusChips[status];
}

export function budgetStatusToProgressColor(
  status: BudgetStatus,
): BudgetProgressColor {
  return budgetProgressColors[status];
}
