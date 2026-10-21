import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "next/link";
import { CategoryBadge } from "@/components/CategoryBadge";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";
import { budgetStatusToProgressColor } from "@/features/dashboard/status";
import { DashboardSection } from "./DashboardSection";

type DashboardRead = components["schemas"]["DashboardRead"];

type BudgetsCardProps = {
  data?: DashboardRead;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
};

export function BudgetsCard({
  data,
  isError,
  isLoading,
  onRetry,
}: BudgetsCardProps) {
  const budgets = data?.budgets.filter((budget) => !budget.is_archived).slice(0, 3);

  return (
    <DashboardSection
      isError={isError}
      isLoading={isLoading}
      label="your budgets"
      onRetry={onRetry}
    >
      {data && (
        <section className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">Your budgets</h2>
              <p className="mt-1 text-sm text-muted">Small steps add up</p>
            </div>
            <Button
              component={Link}
              href="/budgets"
              sx={{ minHeight: 44 }}
              variant="text"
            >
              See all
            </Button>
          </div>

          {budgets?.length ? (
            <div className="mt-5 space-y-5">
              {budgets.map((budget) => {
                const progress =
                  budget.limit_minor > 0
                    ? Math.min(100, (budget.spent_minor / budget.limit_minor) * 100)
                    : 0;
                const statusLabel =
                  budget.status === "near_limit"
                    ? "Near limit"
                    : budget.status === "over_limit"
                      ? "Over limit"
                      : null;

                return (
                  <article key={budget.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <CategoryBadge name={budget.category_name} size={36} />
                        <div className="min-w-0">
                        <h3 className="font-semibold text-foreground">
                          {budget.category_name}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                          {budget.period === "weekly" ? "Weekly" : "Monthly"}
                        </p>
                        </div>
                      </div>
                      {statusLabel && (
                        <Chip
                          color={budget.status === "over_limit" ? "error" : "warning"}
                          label={statusLabel}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {formatGhs(budget.spent_minor)} of {formatGhs(budget.limit_minor)}
                    </p>
                    <LinearProgress
                      aria-label={`${budget.category_name} budget progress`}
                      color={budgetStatusToProgressColor(budget.status)}
                      sx={{ mt: 2, height: 7, borderRadius: 99 }}
                      value={progress}
                      variant="determinate"
                    />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-panel-raised p-4 text-center">
              <p className="font-semibold text-foreground">No budgets yet</p>
              <Button
                className="mt-2"
                component={Link}
                href="/budgets"
                sx={{ minHeight: 44 }}
                variant="outlined"
              >
                Create a budget
              </Button>
            </div>
          )}
        </section>
      )}
    </DashboardSection>
  );
}
