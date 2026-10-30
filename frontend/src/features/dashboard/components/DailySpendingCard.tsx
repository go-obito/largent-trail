import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
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
        <section className="rounded-xl border border-outline bg-surface relative isolate flex h-full flex-col overflow-hidden p-5 sm:p-6">
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Today</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Daily spending
              </h2>
            </div>
            {chip && (
              <Chip
                color={chip.color}
                label={chip.label}
                size="small"
                sx={{
                  flexShrink: 0,
                  bgcolor: "var(--color-surface-elevated)",
                  color: "text.primary",
                  borderColor: "var(--color-border)",
                  fontWeight: 600,
                }}
                variant="outlined"
              />
            )}
          </div>

          <div className="relative z-10 mt-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-muted">Spent today</p>
              <p className="money mt-1 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
                {formatGhs(target.spent_today_minor)}
              </p>
              <p className="money mt-2 text-sm font-medium text-muted">
                {target.target_minor !== null && target.left_minor !== null
                  ? target.left_minor < 0
                    ? `${formatGhs(Math.abs(target.left_minor))} over today's target`
                    : `${formatGhs(target.left_minor)} left of ${formatGhs(target.target_minor)}`
                  : "Set a daily target to stay on track"}
              </p>
            </div>
            <div aria-hidden="true" className="relative hidden size-[76px] shrink-0 items-center justify-center rounded-full border-[7px] border-brand/15 sm:flex">
              <div
                className="flex size-full items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(var(--color-progress-good) ${progress}%, transparent 0)`,
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
                  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
                }}
              />
              <CalendarDays className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-brand" size={23} />
            </div>
          </div>

          {target.target_minor === null ? (
            <Link
              className="relative z-10 mt-5 inline-flex min-h-11 w-fit items-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 text-sm font-semibold text-on-brand transition-opacity hover:opacity-90"
              href="/budgets"
            >
              Set a budget
              <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          ) : (
            <>
              <LinearProgress
                aria-label="Daily target progress"
                sx={{
                  mt: 3,
                  height: 8,
                  borderRadius: 99,
                  backgroundColor: "var(--color-progress-track)",
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 99,
                    backgroundColor: "var(--color-progress-good)",
                  },
                }}
                value={progress}
                variant="determinate"
              />
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted sm:text-sm">
                <span>Spent {formatGhs(target.spent_today_minor)}</span>
                <span>Target {formatGhs(target.target_minor)}</span>
              </div>
            </>
          )}

          <Link
            className="relative z-10 mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-outline px-4 text-sm font-semibold text-foreground transition-colors hover:bg-panel-raised"
            href="/transactions/new?kind=expense"
          >
            Record spending
            <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
        </section>
      )}
    </DashboardSection>
  );
}
