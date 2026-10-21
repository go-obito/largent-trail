"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, createApiClient } from "@/lib/api/client";
import type { components, paths } from "@/lib/api/schema";

type CategoryRead = components["schemas"]["CategoryRead"];
type CategoryPage = components["schemas"]["CategoryPage"];
type CategoryKind = components["schemas"]["CategoryKind"];
type CategoryQuery = NonNullable<
  paths["/v1/categories"]["get"]["parameters"]["query"]
>;

export const categoryKeys = {
  all: ["categories"] as const,
  list: (kind?: CategoryKind) => ["categories", "list", kind] as const,
};

function useApiClient() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const client = useMemo(
    () => createApiClient(getToken, () => clerk.redirectToSignIn()),
    [clerk, getToken],
  );

  return { client, isAuthReady: isLoaded && isSignedIn };
}

function ensurePage(
  data: CategoryPage | undefined,
  status: number,
): CategoryPage {
  if (!data) {
    throw new ApiError(status, null, "The API response did not include categories.");
  }

  return data;
}

export function useCategories(kind?: CategoryKind) {
  const { client, isAuthReady } = useApiClient();

  return useQuery({
    queryKey: categoryKeys.list(kind),
    enabled: isAuthReady,
    queryFn: async () => {
      const categories: CategoryRead[] = [];
      let cursor: string | undefined;

      do {
        const query: CategoryQuery = {
          limit: 200,
          cursor,
          include_archived: false,
          ...(kind ? { kind } : {}),
        };
        const { data, error, response } = await client.GET("/v1/categories", {
          params: { query },
        });
        if (error) {
          throw new ApiError(response.status, null, response.statusText || "The API request failed.", error);
        }

        const page = ensurePage(data, response.status);
        categories.push(...page.items);
        cursor = page.next_cursor ?? undefined;
      } while (cursor);

      return categories;
    },
  });
}
