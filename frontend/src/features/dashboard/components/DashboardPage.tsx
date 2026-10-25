"use client";

import { useState } from "react";
import { BudgetsCard } from "./BudgetsCard";
import { DailySpendingCard } from "./DailySpendingCard";
import { HeroBalanceCard } from "./HeroBalanceCard";
import { PrioritizedNeedsCard } from "./PrioritizedNeedsCard";
import { QuickActions } from "./QuickActions";
import { RecentActivityCard } from "./RecentActivityCard";
import { SpendingOverviewCard } from "./SpendingOverviewCard";
import { StatsCards } from "./StatsCards";
import { WeeklyProgressCard } from "./WeeklyProgressCard";
import { DashboardSection } from "./DashboardSection";
import { useDashboard, type BalanceRange } from "@/features/dashboard/api";
import { useMe } from "@/features/me/api";
import { useReport, type ReportPeriod } from "@/features/reports/api";
import { todayInTz } from "@/lib/dates";

const DEFAULT_TIMEZONE = "Africa/Accra";

export function DashboardPage() {
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
      <div className="order-1 md:col-span-8">
        <HeroBalanceCard {...sectionStatus} data={data} onRangeChange={setRange} range={range} />
      </div>
      <div className="order-2 md:hidden"><QuickActions /></div>
      <div className="order-3 md:col-span-4 md:row-start-1"><DailySpendingCard {...sectionStatus} data={data} /></div>
      <div className="order-4 hidden md:col-span-12 md:block md:row-start-2">
        {data ? <StatsCards data={data} /> : <DashboardSection {...sectionStatus} label="weekly stats">{null}</DashboardSection>}
      </div>
      <div className="order-5 md:col-span-7 md:row-start-3"><RecentActivityCard {...sectionStatus} data={data} timezone={timezone} /></div>
      <div className="order-6 md:col-span-5 md:row-start-3"><SpendingOverviewCard {...reportStatus} data={report.data} onPeriodChange={setReportPeriod} period={reportPeriod} /></div>
      <div className="order-7 md:col-span-4 md:row-start-4"><BudgetsCard {...sectionStatus} data={data} /></div>
      <div className="order-8 md:col-span-4 md:row-start-4"><WeeklyProgressCard {...sectionStatus} data={data} timezone={timezone} /></div>
      <div className="order-9 md:col-span-4 md:row-start-4"><PrioritizedNeedsCard {...sectionStatus} data={data} /></div>
    </div>
  );
}
