"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, createApiClient } from "@/lib/api/client";
import type { components, paths } from "@/lib/api/schema";

export type BalanceRange = NonNullable<
  NonNullable<paths["/v1/dashboard"]["get"]["parameters"]["query"]>["balance_range"]
>;

type DashboardRead = components["schemas"]["DashboardRead"];

export const dashboardKeys = {
  all: ["dashboard"] as const,
  byBalanceRange: (balanceRange: BalanceRange) =>
    ["dashboard", balanceRange] as const,
};

function useApiClient() {
  const { getToken } = useAuth();
  const clerk = useClerk();

  return useMemo(
    () => createApiClient(getToken, () => clerk.redirectToSignIn()),
    [clerk, getToken],
  );
}

function ensureDashboardData(
  data: DashboardRead | undefined,
  status: number,
): DashboardRead {
  if (data === undefined) {
    throw new ApiError(status, null, "The API response did not include dashboard data.");
  }

  return data;
}

export function useDashboard(balanceRange: BalanceRange) {
  const client = useApiClient();

  return useQuery({
    queryKey: dashboardKeys.byBalanceRange(balanceRange),
    queryFn: async () => {
      const { data, error, response } = await client.GET("/v1/dashboard", {
        params: { query: { balance_range: balanceRange } },
      });
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
        );
      }

      return ensureDashboardData(data, response.status);
    },
    staleTime: 30_000,
    refetchOnReconnect: true,
  });
}
