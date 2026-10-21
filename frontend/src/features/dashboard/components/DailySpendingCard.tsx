import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";
import { statusToChip } from "@/features/dashboard/status";
import { DashboardSection } from "./DashboardSection";

type DashboardRead = components["schemas"]["DashboardRead"];

type DailySpendingCardProps = {
  data?: DashboardRead;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
};

export function DailySpendingCard({
  data,
  isError,
  isLoading,
  onRetry,
}: DailySpendingCardProps) {
  const target = data?.daily_target;
  const chip = target?.status ? statusToChip(target.status) : null;
  const over = (target?.left_minor ?? 0) < 0;
  const progress =
    target?.target_minor && target.target_minor > 0
      ? Math.min(100, (target.spent_today_minor / target.target_minor) * 100)
      : 0;

  return (
    <DashboardSection
      isError={isError}
      isLoading={isLoading}
      label="today's spending"
      onRetry={onRetry}
    >
      {data && target && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">Daily spending</h2>
              <p className="mt-1 text-sm text-muted">A simple limit for today</p>
            </div>
            <IconButton
              aria-label="View reports"
              component={Link}
              href="/reports"
              sx={{ minWidth: 44, minHeight: 44, color: "primary.main" }}
            >
              <TrendingUp aria-hidden="true" size={20} />
            </IconButton>
          </div>

          <div className="rounded-3xl border border-outline bg-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Spent today
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                  {formatGhs(target.spent_today_minor)}
                </p>
              </div>
              {chip && (
                <Chip
                  color={chip.color}
                  label={chip.label}
                  size="small"
                  variant="outlined"
                />
              )}
            </div>

            {target.target_minor === null ? (
              <div className="mt-5 rounded-2xl bg-panel-raised p-4">
                <p className="font-semibold text-foreground">No daily target yet</p>
                <p className="mt-1 text-sm text-muted">
                  Set a weekly budget to get a daily limit
                </p>
                <Button
                  className="mt-2"
                  component={Link}
                  href="/budgets"
                  sx={{ minHeight: 44 }}
                  variant="text"
                >
                  Set a budget
                </Button>
              </div>
            ) : (
              <>
                <LinearProgress
                  aria-label="Daily target progress"
                  color={chip?.color ?? "primary"}
                  sx={{ mt: 4, height: 8, borderRadius: 99 }}
                  value={progress}
                  variant="determinate"
                />
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-muted">
                    Daily target {formatGhs(target.target_minor)}
                  </span>
                  {target.left_minor !== null && (
                    <span
                      className={`font-semibold ${
                        over ? "text-status-error" : "text-foreground"
                      }`}
                    >
                      {over
                        ? `${formatGhs(Math.abs(target.left_minor))} over`
                        : `${formatGhs(target.left_minor)} left`}
                    </span>
                  )}
                </div>
                <p className="mt-4 text-sm leading-6 text-muted">
                  Adjusted for what you&apos;ve spent earlier this week.
                </p>
              </>
            )}
            <Button
              className="mt-4 w-full"
              component={Link}
              href="/transactions/new?kind=expense"
              sx={{ minHeight: 44 }}
              variant="outlined"
            >
              Record today&apos;s spending
            </Button>
          </div>
        </section>
      )}
    </DashboardSection>
  );
}
