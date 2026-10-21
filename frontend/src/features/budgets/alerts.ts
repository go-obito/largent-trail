import type { components } from "@/lib/api/schema";
import { budgetPercent } from "./helpers";

type BudgetRead = components["schemas"]["BudgetRead"];
type BudgetStatus = BudgetRead["status"];

const statusRanks: Record<BudgetStatus, number> = {
  within: 0,
  near_limit: 1,
  over_limit: 2,
};

/** Returns the backend status rank used to identify budget escalations. */
export function budgetAlertStatusRank(status: BudgetStatus): number {
  return statusRanks[status];
}

/** Chooses the most severe active budget, breaking ties by server spend percentage. */
export function worstBudgetAlert(budgets: BudgetRead[]): BudgetRead | null {
  return budgets
    .filter((budget) => !budget.is_archived && budget.status !== "within")
    .reduce<BudgetRead | null>((worst, budget) => {
      if (!worst) {
        return budget;
      }

      const rankDifference =
        budgetAlertStatusRank(budget.status) -
        budgetAlertStatusRank(worst.status);
      return rankDifference > 0 ||
        (rankDifference === 0 &&
          budgetPercent(budget.spent_minor, budget.limit_minor) >
            budgetPercent(worst.spent_minor, worst.limit_minor))
        ? budget
        : worst;
    }, null);
}

/** Finds the worst active budget whose backend status worsened since the snapshot. */
export function worstBudgetEscalation(
  before: BudgetRead[],
  after: BudgetRead[],
): BudgetRead | null {
  const previousStatuses = new Map(
    before
      .filter((budget) => !budget.is_archived)
      .map((budget) => [budget.id, budget.status]),
  );
  const escalated = after.filter((budget) => {
    const previousStatus = previousStatuses.get(budget.id);
    return (
      !budget.is_archived &&
      previousStatus !== undefined &&
      budgetAlertStatusRank(budget.status) >
        budgetAlertStatusRank(previousStatus)
    );
  });

  return worstBudgetAlert(escalated);
}

/** Formats the status-backed message shared by the Home banner and save toast. */
export function budgetAlertMessage(
  budget: BudgetRead,
  isEscalation = false,
): string {
  const period = budget.period === "weekly" ? "weekly" : "monthly";
  if (budget.status === "over_limit") {
    return `${budget.category_name} is over its ${period} budget`;
  }

  const now = isEscalation ? " now" : "";
  const percent = budgetPercent(budget.spent_minor, budget.limit_minor);
  return `${budget.category_name} is${now} at ${percent}% of its ${period} budget`;
}
