import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
  compact?: boolean;
  onRetry: () => void;
};

export function BudgetsCard({
  data,
  isError,
  isLoading,
  compact = false,
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
        <section className={`rounded-xl border border-outline bg-surface h-full ${compact ? "p-3 sm:p-4 lg:p-5" : "p-5"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className={`font-bold tracking-tight text-foreground ${compact ? "text-sm sm:text-base" : "text-xl"}`}>Your budgets</h2>
              {!compact && <p className="mt-1 text-sm text-muted">Small steps add up</p>}
            </div>
            <Button
              component={Link}
              href="/budgets"
              endIcon={<ChevronRight aria-hidden="true" size={16} />}
              sx={{ minHeight: 40, flexShrink: 0, fontSize: compact ? 12 : 14, px: compact ? 0.5 : 1.5, fontWeight: 600 }}
              variant="text"
            >
              See all
            </Button>
          </div>

          {budgets?.length ? (
            <div className={compact ? "mt-4 space-y-4 sm:mt-5 sm:space-y-5" : "mt-5 space-y-5"}>
              {budgets.map((budget, index) => {
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
                  <article key={budget.id} className={compact && index > 1 ? "hidden sm:block" : undefined}>
                    <div className="flex min-w-0 items-center gap-2">
                      <CategoryBadge name={budget.category_name} size={36} />
                      <div className="min-w-0 flex-1">
                        <h3 className={`truncate font-semibold text-foreground ${compact ? "text-xs sm:text-sm" : "text-base"}`}>
                          {budget.category_name}
                        </h3>
                        <p className={`mt-0.5 text-muted ${compact ? "text-[10px] sm:text-xs" : "mt-1 text-sm"}`}>
                          {budget.period === "weekly" ? "Weekly" : "Monthly"}
                        </p>
                      </div>
                      {statusLabel && (
                        <Chip
                          color={budget.status === "over_limit" ? "error" : "warning"}
                          label={statusLabel}
                          size="small"
                          variant="outlined"
                          sx={compact ? { display: { xs: "none", sm: "inline-flex" } } : undefined}
                        />
                      )}
                    </div>
                    <p className={`mt-2 font-medium text-foreground ${compact ? "text-[11px] sm:text-xs" : "mt-3 text-sm"}`}>
                      {formatGhs(budget.spent_minor)} of {formatGhs(budget.limit_minor)}
                    </p>
                    <LinearProgress
                      aria-label={`${budget.category_name} budget progress`}
                      color={budgetStatusToProgressColor(budget.status)}
                      sx={{ mt: compact ? 1 : 2, height: compact ? 5 : 7, borderRadius: 99 }}
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
