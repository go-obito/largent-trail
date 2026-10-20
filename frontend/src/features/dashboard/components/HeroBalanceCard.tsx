"use client";

import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import type { BalanceRange } from "@/features/dashboard/api";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";
import { DashboardSection } from "./DashboardSection";

type DashboardRead = components["schemas"]["DashboardRead"];

type HeroBalanceCardProps = {
  data?: DashboardRead;
  isError: boolean;
  isLoading: boolean;
  onRangeChange: (range: BalanceRange) => void;
  onRetry: () => void;
  range: BalanceRange;
};

const rangeLabels: Record<BalanceRange, string> = {
  all_time: "All time",
  this_week: "This week",
  this_month: "This month",
};

function signedAmount(amount: number) {
  return `${amount >= 0 ? "+" : "−"}${formatGhs(Math.abs(amount))}`;
}

export function HeroBalanceCard({
  data,
  isError,
  isLoading,
  onRangeChange,
  onRetry,
  range,
}: HeroBalanceCardProps) {
  return (
    <DashboardSection
      isError={isError}
      isLoading={isLoading}
      label="your balance"
      onRetry={onRetry}
    >
      {data && (
        <section className="rounded-3xl bg-[var(--color-hero)] p-5 text-[var(--color-on-hero)] shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] opacity-75">
                <span aria-hidden="true" className="size-2 rounded-full bg-status-success" />
                Total balance
              </p>
              <p className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {formatGhs(data.total_balance_minor)}
              </p>
              {range !== "all_time" && data.net_change_minor !== null && (
                <p
                  className={`mt-2 text-sm font-semibold ${
                    data.net_change_minor >= 0
                      ? "text-status-success"
                      : "text-status-error"
                  }`}
                >
                  {signedAmount(data.net_change_minor)}{" "}
                  {range === "this_week" ? "this week" : "this month"}
                </p>
              )}
            </div>
            <FormControl size="small">
              <Select
                aria-label="Balance range"
                onChange={(event: SelectChangeEvent<BalanceRange>) =>
                  onRangeChange(event.target.value as BalanceRange)
                }
                sx={{
                  minHeight: 44,
                  color: "onHero",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "divider",
                  },
                  "& .MuiSvgIcon-root": { color: "onHero" },
                }}
                value={range}
              >
                {(Object.keys(rangeLabels) as BalanceRange[]).map((value) => (
                  <MenuItem key={value} value={value}>
                    {rangeLabels[value]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          <div className="mt-6 grid grid-cols-2 divide-x divide-outline/30 border-t border-outline/30 pt-4">
            <div className="pr-4">
              <p className="flex items-center gap-2 text-sm opacity-75">
                <span aria-hidden="true" className="size-2 rounded-full bg-status-success" />
                Income this week
              </p>
              <p className="mt-2 text-lg font-semibold text-status-success">
                +{formatGhs(data.week.income_minor)}
              </p>
            </div>
            <div className="pl-4">
              <p className="flex items-center gap-2 text-sm opacity-75">
                <span aria-hidden="true" className="size-2 rounded-full bg-status-error" />
                Spent this week
              </p>
              <p className="mt-2 text-lg font-semibold text-status-error">
                −{formatGhs(data.week.spent_minor)}
              </p>
            </div>
          </div>
        </section>
      )}
    </DashboardSection>
  );
}
