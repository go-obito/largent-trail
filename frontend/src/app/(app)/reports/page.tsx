"use client";

import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { ArrowLeft, ArrowRight, Banknote, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { useMe } from "@/features/me/api";
import { useReport, type ReportPeriod } from "@/features/reports/api";
import type { components } from "@/lib/api/schema";
import { addDaysToDate, formatDateInTimezone, startOfWeekInTimezone } from "@/lib/date";
import { todayInTz } from "@/lib/dates";
import { formatGhs } from "@/lib/money";
import { chartColors } from "@/styles/palette";

type ReportRead = components["schemas"]["ReportRead"];
type ReportDay = components["schemas"]["ReportDay"];
type TrendMode = "daily" | "weekly";

function shiftMonth(date: string, amount: number) {
  const [year, month] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1));
  return shifted.toISOString().slice(0, 10);
}

function weekRangeLabel(start: string) {
  const end = addDaysToDate(start, 6);
  const startLabel = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${start}T12:00:00Z`));
  const endLabel = new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${end}T12:00:00Z`));
  return `${startLabel}–${endLabel}`;
}

function weeklySeries(days: ReportDay[]): ReportDay[] {
  const totals = new Map<string, number>();
  for (const day of days) {
    const start = startOfWeekInTimezone(day.date);
    totals.set(start, (totals.get(start) ?? 0) + day.expense_minor);
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, expense_minor]) => ({ date, expense_minor }));
}

function StatCard({
  title,
  value,
  kind,
}: {
  title: string;
  value: number;
  kind: "income" | "expense" | "net";
}) {
  const Icon = kind === "income" ? TrendingUp : kind === "expense" ? TrendingDown : Banknote;
  const color =
    kind === "income"
      ? "text-status-success"
      : kind === "expense"
        ? "text-status-error"
        : "text-primary";
  const tint =
    kind === "income"
      ? "bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-surface))]"
      : kind === "expense"
        ? "bg-[color-mix(in_srgb,var(--color-error)_14%,var(--color-surface))]"
        : "bg-selected";
  return (
    <article className="card-surface min-w-0 p-4 md:p-5">
      <span className={`inline-flex size-10 items-center justify-center rounded-full ${tint} ${color}`}>
        <Icon aria-hidden="true" size={19} />
      </span>
      <p className="mt-3 text-sm text-muted">{title}</p>
      <p className={`money mt-1 break-words text-xl font-bold ${color}`}>{formatGhs(value)}</p>
    </article>
  );
}

function SpendingTrend({
  days,
  period,
  timezone,
}: {
  days: ReportDay[];
  period: ReportPeriod;
  timezone: string;
}) {
  const [mode, setMode] = useState<TrendMode>("daily");
  const series = useMemo(
    () => (period === "month" && mode === "weekly" ? weeklySeries(days) : days),
    [days, mode, period],
  );
  const maxMinor = Math.max(0, ...series.map((item) => item.expense_minor));
  const magnitude = maxMinor > 0 ? 10 ** Math.floor(Math.log10(maxMinor)) : 1;
  const step = maxMinor > 0 ? Math.ceil(maxMinor / (4 * magnitude)) * magnitude : 1;
  const axisMax = step * 4;
  const plot = { left: 60, top: 20, width: 680, height: 210 };
  const barStep = plot.width / Math.max(series.length, 1);
  const labelFrequency = Math.max(1, Math.ceil(series.length / 6));

  return (
    <section className="card-surface p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Spending Trend</h2>
        <ToggleButtonGroup
          aria-label="Spending trend grouping"
          exclusive
          onChange={(_, value: TrendMode | null) => value && setMode(value)}
          size="small"
          value={period === "month" ? mode : "daily"}
        >
          <ToggleButton value="daily">Daily</ToggleButton>
          {period === "month" && <ToggleButton value="weekly">Weekly</ToggleButton>}
        </ToggleButtonGroup>
      </div>
      <div className="mt-4 overflow-x-auto">
        <svg
          aria-label={`${period === "month" && mode === "weekly" ? "Weekly" : "Daily"} spending trend, ${series.length} periods`}
          className="h-[270px] min-w-[620px] w-full"
          role="img"
          viewBox="0 0 760 280"
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const value = axisMax - tick * step;
            const y = plot.top + tick * (plot.height / 4);
            return (
              <g key={tick}>
                <line x1={plot.left} x2={plot.left + plot.width} y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="3 5" />
                <text x={plot.left - 8} y={y + 4} fill="var(--color-text-secondary)" fontSize="10" textAnchor="end">{formatGhs(value)}</text>
              </g>
            );
          })}
          {series.map((item, index) => {
            const barHeight = Math.max(0, (item.expense_minor / axisMax) * plot.height);
            const barWidth = Math.min(22, barStep * 0.58);
            const x = plot.left + index * barStep + (barStep - barWidth) / 2;
            const isWeekly = period === "month" && mode === "weekly";
            const label = isWeekly ? weekRangeLabel(item.date) : formatDateInTimezone(item.date, timezone);
            return (
              <g key={`${item.date}-${index}`}>
                <title>{`${label}: ${formatGhs(item.expense_minor)}`}</title>
                <rect
                  x={x}
                  y={plot.top + plot.height - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill="var(--color-primary)"
                />
                {(index % labelFrequency === 0 || index === series.length - 1) && (
                  <text
                    x={x + barWidth / 2}
                    y={plot.top + plot.height + 20}
                    fill="var(--color-text-secondary)"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {isWeekly
                      ? new Intl.DateTimeFormat(undefined, {
                          timeZone: "UTC",
                          month: "short",
                          day: "numeric",
                        }).format(new Date(`${item.date}T12:00:00Z`))
                      : new Intl.DateTimeFormat(undefined, {
                          timeZone: timezone,
                          month: "short",
                          day: "numeric",
                        }).format(new Date(`${item.date}T12:00:00Z`))}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function CategoryDonut({ data }: { data: ReportRead }) {
  const categories = useMemo(() => {
    const sorted = data.spending_by_category
      .filter((item) => item.total_minor > 0)
      .sort((left, right) => right.total_minor - left.total_minor);
    const top = sorted.slice(0, 5).map((item) => ({
      name: item.name || "Uncategorized",
      total_minor: item.total_minor,
    }));
    const rest = sorted.slice(5).reduce((sum, item) => sum + item.total_minor, 0);
    if (rest > 0) top.push({ name: "Other", total_minor: rest });
    return top;
  }, [data]);
  const total = categories.reduce((sum, item) => sum + item.total_minor, 0);
  const circumference = 2 * Math.PI * 58;
  return (
    <section className="card-surface p-5">
      <h2 className="text-lg font-bold text-foreground">Spending by Category</h2>
      {categories.length ? (
        <div className="mt-5 grid grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(140px,0.9fr)_1fr]">
          <div className="relative mx-auto size-44">
            <svg aria-label={`Spending by category totaling ${formatGhs(total)}`} className="size-full -rotate-90" role="img" viewBox="0 0 150 150">
              <circle cx="75" cy="75" r="58" fill="none" stroke="var(--color-surface-elevated)" strokeWidth="18" />
              {categories.map((category, index) => {
                const segment = total ? (category.total_minor / total) * circumference : 0;
                const currentOffset = categories
                  .slice(0, index)
                  .reduce(
                    (sum, previous) =>
                      sum + (total ? (previous.total_minor / total) * circumference : 0),
                    0,
                  );
                return (
                  <circle
                    key={`${category.name}-${index}`}
                    cx="75"
                    cy="75"
                    r="58"
                    fill="none"
                    stroke={chartColors[index % chartColors.length]}
                    strokeDasharray={`${segment} ${circumference - segment}`}
                    strokeDashoffset={-currentOffset}
                    strokeWidth="18"
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <span className="text-xs text-muted">Total spent</span>
              <span className="money mt-1 max-w-full truncate text-lg font-bold text-foreground">{formatGhs(total)}</span>
            </div>
          </div>
          <ul className="space-y-3">
            {categories.map((category, index) => (
              <li key={`${category.name}-${index}`} className="flex items-center gap-2 text-sm">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                <span className="min-w-0 flex-1 truncate text-muted">{category.name}</span>
                <span className="shrink-0 font-semibold text-foreground">{total ? Math.round((category.total_minor / total) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No spending in this period yet.</p>
      )}
    </section>
  );
}

function TopSpendingDays({ days, timezone }: { days: ReportDay[]; timezone: string }) {
  const [showAll, setShowAll] = useState(false);
  const sortedDays = useMemo(
    () => [...days].filter((day) => day.expense_minor > 0).sort((left, right) => right.expense_minor - left.expense_minor || right.date.localeCompare(left.date)),
    [days],
  );
  const visible = showAll ? sortedDays : sortedDays.slice(0, 5);

  return (
    <section className="card-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">Top Spending Days</h2>
        {sortedDays.length > 5 && (
          <Button onClick={() => setShowAll((value) => !value)} sx={{ minHeight: 44 }}>
            {showAll ? "Show top 5" : "See all"}
          </Button>
        )}
      </div>
      {visible.length ? (
        <ol className="mt-3 divide-y divide-outline">
          {visible.map((day, index) => (
            <li key={day.date} className="flex items-center gap-3 py-3">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-panel-raised text-sm font-semibold text-muted">{index + 1}</span>
              <span className="min-w-0 flex-1 text-sm text-foreground">{formatDateInTimezone(day.date, timezone)}</span>
              <span className="money text-sm font-semibold text-foreground">{formatGhs(day.expense_minor)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted">No spending days in this period yet.</p>
      )}
    </section>
  );
}

export default function ReportsPage() {
  const me = useMe();
  const timezone = me.data?.timezone || "Africa/Accra";
  const today = todayInTz(timezone);
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [anchor, setAnchor] = useState<string | null>(null);
  const reportAnchor = anchor ?? today;
  const report = useReport(period, reportAnchor);

  const changePeriod = (nextPeriod: ReportPeriod) => {
    setPeriod(nextPeriod);
    setAnchor(null);
  };
  const shiftPeriod = (amount: number) => {
    setAnchor(() =>
      period === "week"
        ? addDaysToDate(reportAnchor, amount * 7)
        : shiftMonth(reportAnchor, amount),
    );
  };
  const isCurrentRange =
    period === "week"
      ? startOfWeekInTimezone(reportAnchor) >= startOfWeekInTimezone(today)
      : reportAnchor.slice(0, 7) >= today.slice(0, 7);

  if (report.isPending && !report.data) {
    return <LoadingSkeleton label="Loading reports" rows={5} />;
  }
  if (report.isError && !report.data) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted">Understand your spending and build better habits.</p>
        </header>
        <ErrorState onRetry={() => void report.refetch()} />
      </div>
    );
  }
  if (!report.data) return null;

  return (
    <div className="space-y-6 pb-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted">Understand your spending and build better habits.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button aria-label="Previous period" onClick={() => shiftPeriod(-1)} sx={{ minWidth: 44, minHeight: 44 }} variant="outlined"><ArrowLeft aria-hidden="true" size={18} /></Button>
          <FormControl size="small">
            <Select aria-label="Report period" onChange={(event) => changePeriod(event.target.value as ReportPeriod)} value={period}>
              <MenuItem value="week">This week</MenuItem>
              <MenuItem value="month">This month</MenuItem>
            </Select>
          </FormControl>
          <Button aria-label="Next period" disabled={isCurrentRange} onClick={() => shiftPeriod(1)} sx={{ minWidth: 44, minHeight: 44 }} variant="outlined"><ArrowRight aria-hidden="true" size={18} /></Button>
        </div>
      </header>
      {report.isError && (
        <p aria-live="polite" className="rounded-xl border border-outline bg-panel p-3 text-sm text-muted" role="status">
          Showing the saved report. It couldn&apos;t be refreshed just now.
        </p>
      )}
      <section aria-label="Report totals" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard kind="income" title="Total Income" value={report.data.income_minor} />
        <StatCard kind="expense" title="Total Expenses" value={report.data.expense_minor} />
        <StatCard kind="net" title="Net" value={report.data.net_minor} />
      </section>
      <SpendingTrend days={report.data.spending_over_time} period={period} timezone={timezone} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CategoryDonut data={report.data} />
        <TopSpendingDays days={report.data.spending_over_time} timezone={timezone} />
      </div>
    </div>
  );
}
