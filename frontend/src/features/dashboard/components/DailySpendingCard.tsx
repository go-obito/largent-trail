import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
        <section className="flex h-full flex-col rounded-[var(--radius-card)] bg-brand p-5 text-on-brand shadow-sm sm:min-h-[220px] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white/80">Today</p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-on-brand">
                Daily spending
              </h2>
              <p className="mt-3 text-sm text-white/80">
                {target.target_minor === null
                  ? "Set a budget to get a daily limit"
                  : "Your remaining amount for today"}
              </p>
              {target.target_minor !== null && target.left_minor !== null ? (
                <p className="money mt-2 text-4xl font-bold tracking-[-0.03em] text-on-brand">
                  {target.left_minor < 0
                    ? `${formatGhs(Math.abs(target.left_minor))} over`
                    : `${formatGhs(target.left_minor)} left`}
                </p>
              ) : (
                <p className="money mt-2 text-4xl font-bold tracking-[-0.03em] text-on-brand">
                  {formatGhs(target.spent_today_minor)}
                </p>
              )}
            </div>
            {chip && (
              <Chip
                color={chip.color}
                label={chip.label}
                size="small"
                sx={{ bgcolor: "rgba(255, 255, 255, 0.14)", color: "inherit" }}
                variant="outlined"
              />
            )}
          </div>

            {target.target_minor === null ? (
              <Link
                className="mt-6 inline-flex min-h-11 w-fit items-center gap-2 rounded-[var(--radius-control)] bg-white px-4 text-sm font-bold text-brand transition-colors hover:bg-white/90"
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
                    mt: 4,
                    height: 8,
                    borderRadius: 99,
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    "& .MuiLinearProgress-bar": { backgroundColor: "#FFFFFF" },
                  }}
                  value={progress}
                  variant="determinate"
                />
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-white/80">
                  <span>Spent {formatGhs(target.spent_today_minor)}</span>
                  <span>Target {formatGhs(target.target_minor)}</span>
                </div>
              </>
            )}
          <Link
            className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-white/30 px-4 text-sm font-bold text-on-brand transition-colors hover:bg-white/10"
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
