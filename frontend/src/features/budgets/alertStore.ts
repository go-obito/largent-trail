import { create } from "zustand";
import type { components } from "@/lib/api/schema";
import { budgetAlertStatusRank } from "./alerts";

type BudgetRead = components["schemas"]["BudgetRead"];

type BudgetAlertState = {
  dismissedRanks: Record<string, number>;
  dismiss: (budgets: BudgetRead[]) => void;
};

export const useBudgetAlertStore = create<BudgetAlertState>((set) => ({
  dismissedRanks: {},
  dismiss: (budgets) =>
    set((state) => {
      const dismissedRanks = { ...state.dismissedRanks };
      for (const budget of budgets) {
        dismissedRanks[budget.id] = budgetAlertStatusRank(budget.status);
      }
      return { dismissedRanks };
    }),
}));
