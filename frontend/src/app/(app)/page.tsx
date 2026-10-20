"use client";

import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { BudgetsCard } from "@/features/dashboard/components/BudgetsCard";
import { DailySpendingCard } from "@/features/dashboard/components/DailySpendingCard";
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { HeroBalanceCard } from "@/features/dashboard/components/HeroBalanceCard";
import { PrioritizedNeedsCard } from "@/features/dashboard/components/PrioritizedNeedsCard";
import { RecentActivityCard } from "@/features/dashboard/components/RecentActivityCard";
import { WeeklyProgressCard } from "@/features/dashboard/components/WeeklyProgressCard";
import { useDashboard, type BalanceRange } from "@/features/dashboard/api";
import { useMe } from "@/features/me/api";

const DEFAULT_TIMEZONE = "Africa/Accra";

export default function HomePage() {
  const { user } = useUser();
  const me = useMe();
  const [range, setRange] = useState<BalanceRange>("all_time");
  const dashboard = useDashboard(range);
  const name =
    me.data?.display_name?.trim() ||
    user?.fullName?.trim() ||
    user?.firstName?.trim() ||
    "there";
  const timezone = me.data?.timezone || DEFAULT_TIMEZONE;
  const data = dashboard.data;
  const sectionStatus = {
    isError: dashboard.isError,
    isLoading: dashboard.isPending,
    onRetry: () => void dashboard.refetch(),
  };

  return (
    <div className="space-y-6 pb-4">
      <DashboardHeader name={name} timezone={timezone} />
      <HeroBalanceCard
        {...sectionStatus}
        data={data}
        onRangeChange={setRange}
        range={range}
      />
      <DailySpendingCard {...sectionStatus} data={data} />
      <WeeklyProgressCard {...sectionStatus} data={data} timezone={timezone} />
      <BudgetsCard {...sectionStatus} data={data} />
      <PrioritizedNeedsCard {...sectionStatus} data={data} />
      <RecentActivityCard
        {...sectionStatus}
        data={data}
        timezone={timezone}
      />
    </div>
  );
}
