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
  compact?: boolean;
  onPeriodChange: (period: ReportPeriod) => void;
  onRetry: () => void;
  period: ReportPeriod;
};

export function SpendingOverviewCard({
  data,
  isError,
  isLoading,
  compact = false,
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
        <section className={`card-surface h-full ${compact ? "p-3 sm:p-4 lg:p-5" : "p-5"}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={`min-w-0 font-bold tracking-tight text-foreground ${compact ? "text-sm sm:text-base" : "text-lg"}`}>
              {compact ? "Spending by category" : "Spending overview"}
            </h2>
            <FormControl size="small" sx={compact ? { flexShrink: 0, minWidth: 0, maxWidth: 94 } : undefined}>
              <Select
                aria-label="Spending overview range"
                onChange={(event: SelectChangeEvent<ReportPeriod>) =>
                  onPeriodChange(event.target.value as ReportPeriod)
                }
                renderValue={(selected) => compact
                  ? selected === "month" ? "Month" : "Week"
                  : selected === "month" ? "This month" : "This week"}
                sx={compact ? {
                  height: 36,
                  fontSize: 12,
                  "& .MuiSelect-select": { py: 0.75, pl: 1, pr: "26px !important" },
                  "& .MuiSelect-icon": { right: 4 },
                } : undefined}
                value={period}
              >
                <MenuItem value="month">This month</MenuItem>
                <MenuItem value="week">This week</MenuItem>
              </Select>
            </FormControl>
          </div>
          <div className={`mt-4 grid items-center ${compact ? "grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] sm:gap-2 lg:gap-4" : "grid-cols-1 gap-5 sm:grid-cols-[minmax(150px,0.9fr)_1fr]"}`}>
            <div className={`relative mx-auto ${compact ? "size-24 sm:size-28 lg:size-40" : "size-44"}`}>
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
                  return (
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
                })}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                <span className={`text-muted ${compact ? "text-[10px] sm:text-xs" : "text-xs"}`}>Total spent</span>
                <span className={`money mt-0.5 max-w-full truncate font-bold text-foreground ${compact ? "text-sm sm:text-base lg:text-lg" : "text-lg"}`}>
                  {formatGhs(data.expense_minor)}
                </span>
              </div>
            </div>
            {categories.length ? (
              <ul className={compact ? "space-y-2 sm:space-y-2.5" : "space-y-3"}>
                {categories.map((item, index) => {
                  const percent = data.expense_minor > 0
                    ? Math.round((item.total_minor / data.expense_minor) * 100)
                    : 0;
                  return (
                    <li
                      key={`${item.name ?? "uncategorized"}-${index}`}
                      className={`flex min-w-0 items-center gap-2 ${compact ? "text-xs sm:text-sm" : "text-sm"}`}
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
              <p className="text-center text-xs text-muted sm:text-sm">
                No spending in this period yet.
              </p>
            )}
          </div>
        </section>
      )}
    </DashboardSection>
  );
}
