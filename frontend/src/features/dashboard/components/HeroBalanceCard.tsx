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
        <section className="rounded-[var(--radius-card)] bg-[linear-gradient(115deg,color-mix(in_srgb,var(--color-hero)_82%,var(--color-primary)),var(--color-hero))] p-5 text-[var(--color-on-hero)] shadow-sm sm:min-h-[220px] sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[color-mix(in_srgb,var(--color-on-hero)_78%,transparent)]">
                Total Balance
              </p>
              <p className="money mt-3 text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
                {formatGhs(data.total_balance_minor)}
              </p>
              <p className="mt-3 text-sm text-[color-mix(in_srgb,var(--color-on-hero)_78%,transparent)]">
                Across all your accounts
              </p>
              {data.net_change_minor !== null && (
                <p
                  className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-[var(--color-on-hero)]"
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

        </section>
      )}
    </DashboardSection>
  );
}
