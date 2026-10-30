"use client";

import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import type { BalanceRange } from "@/features/dashboard/api";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";
import Link from "next/link";
import { ArrowUpRight, WalletCards } from "lucide-react";
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
        <section className="relative isolate overflow-hidden rounded-2xl bg-[#2457D6] p-5 text-white sm:p-7 lg:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -right-8 -top-10 size-48 rotate-12 border-[24px] border-white/10" />
            <div className="absolute bottom-0 right-0 flex h-24 items-end gap-1.5 pr-4 opacity-20 sm:gap-2 sm:pr-8 sm:opacity-30">
              {chartBars.map((height, index) => (
                <span
                  key={index}
                  className="w-2 bg-white/60 sm:w-3"
                  style={{ height: `${height}px` }}
                />
              ))}
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium tracking-wide text-white/80">
                Total balance
              </p>
              <p className="money mt-3 text-4xl font-bold tracking-[-0.045em] sm:text-5xl lg:text-[3.25rem]">
                {formatGhs(data.total_balance_minor)}
              </p>
              {data.net_change_minor !== null && (
                <p
                  className={`money mt-4 inline-flex max-w-full items-center border px-3 py-1.5 text-xs font-semibold sm:text-sm ${data.net_change_minor >= 0 ? "border-white/20 bg-white/10 text-white" : "border-white/20 bg-black/10 text-white"}`}
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
                  color: "#ffffff",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255,255,255,0.10)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.22)",
                  },
                  "&:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.42)",
                  },
                  "& .MuiSvgIcon-root": { color: "#ffffff" },
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

          <div className="relative z-10 mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/20 pt-4 sm:mt-8">
            <p className="text-xs font-medium text-white/75 sm:text-sm">
              Across your Largent accounts
            </p>
            <Link
              className="inline-flex min-h-11 items-center gap-2 border border-white/30 bg-white px-4 text-sm font-semibold text-[#173C9D] transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              href="/profile/accounts"
            >
              <WalletCards aria-hidden="true" size={17} />
              View accounts
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </section>
      )}
    </DashboardSection>
  );
}
