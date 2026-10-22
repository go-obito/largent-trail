"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, createApiClient } from "@/lib/api/client";
import { requireOnline } from "@/lib/api/offline";
import type { components, paths } from "@/lib/api/schema";
import { uuidv7 } from "@/lib/uuid";

type AccountCreate = components["schemas"]["AccountCreate"];
type AccountRead = components["schemas"]["AccountRead"];
type AccountPage = components["schemas"]["AccountPage"];
type AccountUpdate = components["schemas"]["AccountUpdate"];
type AccountQuery = NonNullable<
  paths["/v1/accounts"]["get"]["parameters"]["query"]
>;
type ChangedFields<T> = {
  [Key in keyof T]?: NonNullable<T[Key]>;
};

type CreateAccountInput = Pick<AccountCreate, "name" | "type"> &
  Partial<Omit<AccountCreate, "id" | "name" | "type">> & { id?: string };
export type UpdateAccountInput = {
  id: string;
  changes: ChangedFields<
    Pick<
      AccountUpdate,
      "name" | "type" | "opening_balance_minor" | "is_archived" | "position"
    >
  >;
};

export type AccountsSummary = {
  accountCount: number;
  totalBalanceMinor: number;
};

export const accountKeys = {
  all: ["accounts"] as const,
  list: (includeArchived: boolean) =>
    ["accounts", "list", { includeArchived }] as const,
};

const relatedInvalidationKeys = [
  accountKeys.all,
  ["dashboard"],
  ["transactions"],
  ["needs"],
] as const;

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

export async function fetchAllAccounts(
  client: ReturnType<typeof createApiClient>,
  includeArchived = false,
): Promise<AccountRead[]> {
  const accounts: AccountRead[] = [];
  let cursor: string | undefined;

  do {
    const query: AccountQuery = {
      limit: 200,
      cursor,
      include_archived: includeArchived,
    };
    const { data, error, response } = await client.GET("/v1/accounts", {
      params: { query },
    });
    if (error) {
      throw new ApiError(
        response.status,
        null,
        response.statusText || "The API request failed.",
        error,
      );
    }

    const page = ensurePage(data, response.status);
    accounts.push(...page.items);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  return accounts;
}

const summarizeAccounts = (accounts: AccountRead[]): AccountsSummary => ({
  accountCount: accounts.length,
  totalBalanceMinor: accounts.reduce(
    (total, account) => total + account.balance_minor,
    0,
  ),
});

async function invalidateAccountQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all(
    relatedInvalidationKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useAccounts(
  { includeArchived = false }: { includeArchived?: boolean } = {},
) {
  const { client, isAuthReady } = useApiClient();

  return useQuery({
    queryKey: accountKeys.list(includeArchived),
    enabled: isAuthReady,
    queryFn: () => fetchAllAccounts(client, includeArchived),
  });
}

export function useAccountsSummary(
  { includeArchived = false }: { includeArchived?: boolean } = {},
) {
  const accountsQuery = useAccounts({ includeArchived });

  return {
    ...accountsQuery,
    data: accountsQuery.data
      ? summarizeAccounts(accountsQuery.data)
      : undefined,
  };
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
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }
      return ensureAccount(data, response.status);
    },
    onSuccess: () => invalidateAccountQueries(queryClient),
  });
}

export function useUpdateAccount() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, changes }: UpdateAccountInput) => {
      requireOnline();
      if (Object.keys(changes).length === 0) {
        throw new Error("Provide at least one changed account field.");
      }

      const { data, error, response } = await client.PATCH(
        "/v1/accounts/{account_id}",
        { params: { path: { account_id: id } }, body: changes },
      );
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureAccount(data, response.status);
    },
    onSuccess: () => invalidateAccountQueries(queryClient),
  });
}

export function useDeleteAccount() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      requireOnline();
      const { error, response } = await client.DELETE(
        "/v1/accounts/{account_id}",
        { params: { path: { account_id: id } } },
      );
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }
    },
    onSuccess: () => invalidateAccountQueries(queryClient),
  });
}
