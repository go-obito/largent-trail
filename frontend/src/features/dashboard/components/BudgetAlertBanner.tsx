"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Link from "next/link";
import type { components } from "@/lib/api/schema";
import {
  budgetAlertMessage,
  budgetAlertStatusRank,
  worstBudgetAlert,
} from "@/features/budgets/alerts";
import { useBudgetAlertStore } from "@/features/budgets/alertStore";

type BudgetRead = components["schemas"]["BudgetRead"];

const noBudgets: BudgetRead[] = [];

export function BudgetAlertBanner({ budgets = noBudgets }: { budgets?: BudgetRead[] }) {
  const dismissedRanks = useBudgetAlertStore((state) => state.dismissedRanks);
  const dismiss = useBudgetAlertStore((state) => state.dismiss);
  const visibleBudgets = budgets.filter(
    (budget) =>
      !budget.is_archived &&
      budget.status !== "within" &&
      budgetAlertStatusRank(budget.status) >
        (dismissedRanks[budget.id] ?? -1),
  );
  const worstBudget = worstBudgetAlert(visibleBudgets);

  if (!worstBudget) {
    return null;
  }

  const otherCount = visibleBudgets.length - 1;

  return (
    <Alert
      action={
        <Button
          component={Link}
          href="/budgets"
          sx={{ minHeight: 44, whiteSpace: "nowrap" }}
          color="inherit"
          size="small"
        >
          View budgets
        </Button>
      }
      className="rounded-2xl"
      onClose={() => dismiss(visibleBudgets)}
      severity={worstBudget.status === "over_limit" ? "error" : "warning"}
    >
      <p className="font-semibold">{budgetAlertMessage(worstBudget)}</p>
      {otherCount > 0 && (
        <p className="mt-1 text-sm">
          {otherCount} other {otherCount === 1 ? "budget needs" : "budgets need"}{" "}
          attention
        </p>
      )}
    </Alert>
  );
}
