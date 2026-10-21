"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, createApiClient } from "@/lib/api/client";
import { requireOnline } from "@/lib/api/offline";
import type { components } from "@/lib/api/schema";
import { uuidv7 } from "@/lib/uuid";

type AccountCreate = components["schemas"]["AccountCreate"];
type AccountRead = components["schemas"]["AccountRead"];
type AccountPage = components["schemas"]["AccountPage"];
type CreateAccountInput = Pick<AccountCreate, "name" | "type"> &
  Partial<Omit<AccountCreate, "id" | "name" | "type">> & { id?: string };

export const accountKeys = {
  all: ["accounts"] as const,
  list: () => ["accounts", "list"] as const,
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

function ensurePage(data: AccountPage | undefined, status: number): AccountPage {
  if (!data) {
    throw new ApiError(status, null, "The API response did not include accounts.");
  }

  return data;
}

function ensureAccount(data: AccountRead | undefined, status: number): AccountRead {
  if (!data) {
    throw new ApiError(status, null, "The API response did not include the account.");
  }

  return data;
}

async function fetchAllAccounts(
  client: ReturnType<typeof createApiClient>,
): Promise<AccountRead[]> {
  const accounts: AccountRead[] = [];
  let cursor: string | undefined;

  do {
    const { data, error, response } = await client.GET("/v1/accounts", {
      params: { query: { limit: 200, cursor, include_archived: false } },
    });
    if (error) {
      throw new ApiError(response.status, null, response.statusText || "The API request failed.", error);
    }

    const page = ensurePage(data, response.status);
    accounts.push(...page.items);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  return accounts;
}

export function useAccounts() {
  const { client, isAuthReady } = useApiClient();

  return useQuery({
    queryKey: accountKeys.list(),
    enabled: isAuthReady,
    queryFn: () => fetchAllAccounts(client),
  });
}

export function useCreateAccount() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      requireOnline();
      const body: AccountCreate = {
        id: input.id ?? uuidv7(),
        name: input.name,
        type: input.type,
        opening_balance_minor: input.opening_balance_minor ?? 0,
        currency: input.currency ?? "GHS",
        is_archived: input.is_archived ?? false,
        position: input.position ?? 0,
      };
      const { data, error, response } = await client.POST("/v1/accounts", {
        body,
      });
      if (error) {
        throw new ApiError(response.status, null, response.statusText || "The API request failed.", error);
      }
      return ensureAccount(data, response.status);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["reports"] }),
      ]);
    },
  });
}
