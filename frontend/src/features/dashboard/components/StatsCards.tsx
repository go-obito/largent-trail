import LinearProgress from "@mui/material/LinearProgress";
import { PiggyBank, Target, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";

type DashboardRead = components["schemas"]["DashboardRead"];

function StatCard({
  label,
  amount,
  Icon,
  tone,
  footer,
}: {
  label: string;
  amount: string;
  Icon: LucideIcon;
  tone: "success" | "error" | "primary" | "secondary";
  footer?: ReactNode;
}) {
  const toneClasses = {
    success: "bg-status-success/10 text-status-success",
    error: "bg-status-error/10 text-status-error",
    primary: "bg-brand/10 text-brand",
    secondary: "bg-selected text-muted",
  } as const;

  return (
    <article className="rounded-xl border border-outline bg-surface min-w-0 p-4 sm:p-5">
      <span className={`inline-flex size-10 items-center justify-center rounded-full ${toneClasses[tone]}`}>
        <Icon aria-hidden="true" size={20} />
      </span>
      <p className="mt-3 text-sm font-medium text-muted">{label}</p>
      <p className="money mt-1 truncate text-xl font-bold tracking-tight text-foreground">
        {amount}
      </p>
      {footer && <div className="mt-3">{footer}</div>}
    </article>
  );
}

export function StatsCards({ data }: { data: DashboardRead }) {
  const needsProgress =
    data.needs.total_target_minor > 0
      ? Math.min(
          100,
          (data.needs.total_allocated_minor / data.needs.total_target_minor) *
            100,
        )
      : 0;
  const needsPercent = Math.floor(needsProgress);

  return (
    <section aria-label="This week's money summary">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-[-0.02em] text-foreground">This week</h2>
        <span className="text-sm text-muted">A quick snapshot</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        <StatCard
          Icon={TrendingUp}
          amount={formatGhs(data.week.income_minor)}
          label="Income"
          tone="success"
          footer={<p className="text-xs text-muted">This week</p>}
        />
        <StatCard
          Icon={TrendingDown}
          amount={formatGhs(data.week.spent_minor)}
          label="Expenses"
          tone="error"
          footer={<p className="text-xs text-muted">This week</p>}
        />
        <StatCard
          Icon={PiggyBank}
          amount={formatGhs(data.needs.unallocated_savings_minor)}
          label="Savings"
          tone="primary"
          footer={<p className="text-xs text-muted">Unallocated savings</p>}
        />
        <StatCard
          Icon={Target}
          amount={`${formatGhs(data.needs.total_target_minor)} planned`}
          label="Needs"
          tone="secondary"
          footer={
            <>
              <LinearProgress
                aria-label={`${needsPercent}% of planned needs saved`}
                sx={{ height: 6, borderRadius: 99 }}
                value={needsProgress}
                variant="determinate"
              />
              <p className="mt-2 text-xs text-muted">{needsPercent}% saved</p>
            </>
          }
        />
      </div>
    </section>
  );
}
