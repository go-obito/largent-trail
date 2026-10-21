"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, createApiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type ReportRead = components["schemas"]["ReportRead"];
export type ReportPeriod = ReportRead["period"];

export const reportKeys = {
  all: ["reports"] as const,
  byPeriod: (period: ReportPeriod, anchor: string) =>
    ["reports", period, anchor] as const,
};

export function useReport(period: ReportPeriod, anchor: string) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const client = useMemo(
    () => createApiClient(getToken, () => clerk.redirectToSignIn()),
    [clerk, getToken],
  );

  return useQuery({
    queryKey: reportKeys.byPeriod(period, anchor),
    enabled: isLoaded && isSignedIn,
    queryFn: async () => {
      const { data, error, response } = await client.GET("/v1/reports", {
        params: { query: { period, anchor } },
      });
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }
      return data;
    },
    staleTime: 30_000,
    refetchOnReconnect: true,
  });
}
