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

const chartBars = [25, 43, 63, 39, 50, 30, 45];

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
        <section className="relative isolate overflow-hidden rounded-3xl bg-[linear-gradient(125deg,color-mix(in_srgb,var(--color-primary)_82%,var(--color-hero)),var(--color-hero)_88%)] p-5 text-[var(--color-on-hero)] shadow-sm sm:p-6 lg:p-7">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -right-12 -top-24 size-64 rounded-full bg-brand/15 blur-3xl" />
            <div className="absolute bottom-0 right-0 flex h-24 items-end gap-1.5 pr-4 opacity-20 sm:gap-2 sm:pr-8 sm:opacity-30">
              {chartBars.map((height, index) => (
                <span
                  key={index}
                  className="w-2 rounded-full bg-[var(--color-on-hero)]/70 sm:w-3"
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-wide text-white/75">
                Total balance
              </p>
              <p className="money mt-3 text-4xl font-bold tracking-[-0.04em] sm:text-4xl lg:text-5xl">
                {formatGhs(data.total_balance_minor)}
              </p>
              {data.net_change_minor !== null && (
                <p
                  className={`money mt-4 inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-semibold sm:text-sm ${data.net_change_minor >= 0 ? "bg-status-success/15 text-status-success" : "bg-status-error/15 text-status-error"}`}
                >
                  {signedAmount(data.net_change_minor)}{" "}
                  {range === "all_time"
                    ? "net change"
                    : range === "this_week"
                      ? "this week"
                      : "this month"}
                </p>
              )}
            </div>
            <FormControl size="small" sx={{ minWidth: 112 }}>
              <Select
                aria-label="Balance range"
                onChange={(event: SelectChangeEvent<BalanceRange>) =>
                  onRangeChange(event.target.value as BalanceRange)
                }
                sx={{
                  minHeight: 44,
                  color: "onHero",
                  borderRadius: "14px",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.22)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.42)",
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
        </section>
      )}
    </DashboardSection>
  );
}
