"use client";

import { useState } from "react";
import { BudgetsCard } from "@/features/dashboard/components/BudgetsCard";
import { DailySpendingCard } from "@/features/dashboard/components/DailySpendingCard";
import { HeroBalanceCard } from "@/features/dashboard/components/HeroBalanceCard";
import { PrioritizedNeedsCard } from "@/features/dashboard/components/PrioritizedNeedsCard";
import { QuickActions } from "@/features/dashboard/components/QuickActions";
import { RecentActivityCard } from "@/features/dashboard/components/RecentActivityCard";
import { SpendingOverviewCard } from "@/features/dashboard/components/SpendingOverviewCard";
import { StatsCards } from "@/features/dashboard/components/StatsCards";
import { WeeklyProgressCard } from "@/features/dashboard/components/WeeklyProgressCard";
import { useDashboard, type BalanceRange } from "@/features/dashboard/api";
import { useMe } from "@/features/me/api";
import { useReport, type ReportPeriod } from "@/features/reports/api";
import { todayInTz } from "@/lib/dates";
import { DashboardSection } from "@/features/dashboard/components/DashboardSection";

const DEFAULT_TIMEZONE = "Africa/Accra";

export default function HomePage() {
  const me = useMe();
  const [range, setRange] = useState<BalanceRange>("all_time");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("month");
  const dashboard = useDashboard(range);
  const timezone = me.data?.timezone || DEFAULT_TIMEZONE;
  const data = dashboard.data;
  const report = useReport(reportPeriod, todayInTz(timezone));
  const sectionStatus = {
    isError: dashboard.isError && !data,
    isLoading: dashboard.isPending && !data,
    onRetry: () => void dashboard.refetch(),
  };
  const reportStatus = {
    isError: report.isError && !report.data,
    isLoading: report.isPending && !report.data,
    onRetry: () => void report.refetch(),
  };

  return (
    <div className="grid grid-cols-1 gap-4 pb-4 md:grid-cols-12 md:gap-6">
      <header className="order-1 md:col-span-12">
        <h1 className="max-w-[18ch] text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
          Your financial briefing
        </h1>
        <p className="mt-2 max-w-[52ch] text-sm leading-6 text-muted sm:text-base">
          A clear view of what matters for your money today.
        </p>
      </header>
      <div className="order-2 md:col-span-7">
        <HeroBalanceCard
          {...sectionStatus}
          data={data}
          onRangeChange={setRange}
          range={range}
        />
      </div>
      <div className="order-3 md:hidden">
        <QuickActions />
      </div>
      <div className="order-4 md:col-span-5 md:row-start-2">
        <DailySpendingCard {...sectionStatus} data={data} />
      </div>
      <div className="order-5 md:col-span-12 md:row-start-3">
        {data ? (
          <StatsCards data={data} />
        ) : (
          <DashboardSection {...sectionStatus} label="weekly stats">
            {null}
          </DashboardSection>
        )}
      </div>
      <div className="order-6 md:col-span-7 md:row-start-4">
        <RecentActivityCard
          {...sectionStatus}
          data={data}
          timezone={timezone}
        />
      </div>
      <div className="order-7 md:col-span-5 md:row-start-4">
        <SpendingOverviewCard
          {...reportStatus}
          data={report.data}
          onPeriodChange={setReportPeriod}
          period={reportPeriod}
        />
      </div>
      <div className="order-8 md:col-span-4 md:row-start-5">
        <BudgetsCard {...sectionStatus} data={data} />
      </div>
      <div className="order-9 md:col-span-4 md:row-start-5">
        <WeeklyProgressCard
          {...sectionStatus}
          data={data}
          timezone={timezone}
        />
      </div>
      <div className="order-10 md:col-span-4 md:row-start-5">
        <PrioritizedNeedsCard {...sectionStatus} data={data} />
      </div>
    </div>
  );
}
