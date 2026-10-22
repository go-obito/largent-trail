"use client";

import { AccountsPage } from "@/features/accounts/components/AccountsPage";
import { useDashboard } from "@/features/dashboard/api";

export default function AccountsRoutePage() {
  const dashboard = useDashboard("all_time");

  return (
    <AccountsPage
      homeTotalBalanceMinor={dashboard.data?.total_balance_minor}
      isHomeBalanceError={dashboard.isError}
      isHomeBalanceFetching={dashboard.isFetching}
      onRetryHomeBalance={() => void dashboard.refetch()}
    />
  );
}
