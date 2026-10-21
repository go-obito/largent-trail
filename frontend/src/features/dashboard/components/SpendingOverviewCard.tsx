"use client";

import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { DashboardSection } from "./DashboardSection";
import { chartColors } from "@/styles/palette";
import { formatGhs } from "@/lib/money";
import type { ReportPeriod } from "@/features/reports/api";
import type { components } from "@/lib/api/schema";

type ReportRead = components["schemas"]["ReportRead"];

type SpendingOverviewCardProps = {
  data?: ReportRead;
  isError: boolean;
  isLoading: boolean;
  onPeriodChange: (period: ReportPeriod) => void;
  onRetry: () => void;
  period: ReportPeriod;
};

export function SpendingOverviewCard({
  data,
  isError,
  isLoading,
  onPeriodChange,
  onRetry,
  period,
}: SpendingOverviewCardProps) {
  const categories = useMemo(() => {
    if (!data) return [];
    const sorted = data.spending_by_category
      .filter((item) => item.total_minor > 0)
      .sort((left, right) => right.total_minor - left.total_minor);
    const visible = sorted.slice(0, 5);
    const otherTotal = sorted
      .slice(5)
      .reduce((total, item) => total + item.total_minor, 0);
    if (otherTotal > 0) {
      visible.push({ category_id: null, name: "Other", total_minor: otherTotal });
    }
    return visible;
  }, [data]);
  const ringTotal = categories.reduce((total, item) => total + item.total_minor, 0);
  const radius = 64;
  const circumference = 2 * Math.PI * radius;

  return (
    <DashboardSection
      isError={isError}
      isLoading={isLoading}
      label="spending overview"
      onRetry={onRetry}
    >
      {data && (
        <section className="card-surface h-full p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">Spending overview</h2>
            <FormControl size="small">
              <Select
                aria-label="Spending overview range"
                onChange={(event: SelectChangeEvent<ReportPeriod>) =>
                  onPeriodChange(event.target.value as ReportPeriod)
                }
                value={period}
              >
                <MenuItem value="month">This month</MenuItem>
                <MenuItem value="week">This week</MenuItem>
              </Select>
            </FormControl>
          </div>
          <div className="mt-5 grid grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(150px,0.9fr)_1fr]">
            <div className="relative mx-auto size-44">
              <svg
                aria-label={`Spending by category totaling ${formatGhs(data.expense_minor)}`}
                className="size-full -rotate-90"
                role="img"
                viewBox="0 0 160 160"
              >
                <circle
                  cx="80"
                  cy="80"
                  fill="none"
                  r={radius}
                  stroke="var(--color-surface-elevated)"
                  strokeWidth="19"
                />
                {categories.map((item, index) => {
                  const segment = ringTotal > 0
                    ? (item.total_minor / ringTotal) * circumference
                    : 0;
                  const offset = categories
                    .slice(0, index)
                    .reduce(
                      (total, category) =>
                        total + (category.total_minor / ringTotal) * circumference,
                      0,
                    );
                  const style = {
                    "--chart-color": chartColors[index % chartColors.length],
                  } as CSSProperties;
                  const circle = (
                    <circle
                      key={`${item.name ?? "uncategorized"}-${index}`}
                      cx="80"
                      cy="80"
                      fill="none"
                      r={radius}
                      stroke="var(--chart-color)"
                      strokeDasharray={`${segment} ${circumference - segment}`}
                      strokeDashoffset={-offset}
                      strokeLinecap="butt"
                      strokeWidth="19"
                      style={style}
                    />
                  );
                  return circle;
                })}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
                <span className="text-xs text-muted">Total spent</span>
                <span className="money mt-1 max-w-full truncate text-lg font-bold text-foreground">
                  {formatGhs(data.expense_minor)}
                </span>
              </div>
            </div>
            {categories.length ? (
              <ul className="space-y-3">
                {categories.map((item, index) => {
                  const percent = data.expense_minor > 0
                    ? Math.round((item.total_minor / data.expense_minor) * 100)
                    : 0;
                  return (
                    <li
                      key={`${item.name ?? "uncategorized"}-${index}`}
                      className="flex min-w-0 items-center gap-2 text-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          "--chart-color": chartColors[index % chartColors.length],
                          backgroundColor: "var(--chart-color)",
                        } as CSSProperties}
                      />
                      <span className="min-w-0 flex-1 truncate text-muted">
                        {item.name || "Uncategorized"}
                      </span>
                      <span className="shrink-0 font-semibold text-foreground">
                        {percent}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-center text-sm text-muted">
                No spending in this period yet.
              </p>
            )}
          </div>
        </section>
      )}
    </DashboardSection>
  );
}
