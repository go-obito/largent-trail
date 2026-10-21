"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, createApiClient } from "@/lib/api/client";
import { requireOnline } from "@/lib/api/offline";
import type { components } from "@/lib/api/schema";
import { uuidv7 } from "@/lib/uuid";

type BudgetCreate = components["schemas"]["BudgetCreate"];
type BudgetPage = components["schemas"]["BudgetPage"];
type BudgetRead = components["schemas"]["BudgetRead"];
type BudgetUpdate = components["schemas"]["BudgetUpdate"];

export type CreateBudgetInput = Omit<
  BudgetCreate,
  "id" | "currency" | "is_archived"
>;
export type UpdateBudgetInput = {
  id: string;
  changes: Pick<BudgetUpdate, "limit_minor" | "is_archived">;
};

export const budgetKeys = {
  all: ["budgets"] as const,
  list: () => ["budgets", "list"] as const,
  detail: (id: string) => ["budgets", "detail", id] as const,
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
  data: BudgetPage | undefined,
  status: number,
): BudgetPage {
  if (!data) {
    throw new ApiError(status, null, "The API response did not include budgets.");
  }

  return data;
}

function ensureBudget(
  data: BudgetRead | undefined,
  status: number,
): BudgetRead {
  if (!data) {
    throw new ApiError(status, null, "The API response did not include the budget.");
  }

  return data;
}

async function fetchAllBudgets(
  client: ReturnType<typeof createApiClient>,
): Promise<BudgetRead[]> {
  const budgets: BudgetRead[] = [];
  let cursor: string | undefined;

  do {
    const { data, error, response } = await client.GET("/v1/budgets", {
      params: {
        query: {
          limit: 200,
          cursor,
          include_archived: true,
        },
      },
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
    budgets.push(...page.items);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  return budgets;
}

async function invalidateBudgetQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all(
    [budgetKeys.all, ["dashboard"], ["reports"]].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useBudgets() {
  const { client, isAuthReady } = useApiClient();

  return useQuery({
    queryKey: budgetKeys.list(),
    enabled: isAuthReady,
    queryFn: () => fetchAllBudgets(client),
  });
}

export function useBudget(id: string) {
  const { client, isAuthReady } = useApiClient();
  const queryClient = useQueryClient();
  const listState = queryClient.getQueryState<BudgetRead[]>(budgetKeys.list());
  const cachedBudget = queryClient
    .getQueryData<BudgetRead[]>(budgetKeys.list())
    ?.find((budget) => budget.id === id);

  return useQuery({
    queryKey: budgetKeys.detail(id),
    enabled: isAuthReady && id.length > 0,
    initialData: cachedBudget,
    initialDataUpdatedAt: cachedBudget ? listState?.dataUpdatedAt : undefined,
    queryFn: async () => {
      const { data, error, response } = await client.GET(
        "/v1/budgets/{budget_id}",
        { params: { path: { budget_id: id } } },
      );
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureBudget(data, response.status);
    },
  });
}

export function useCreateBudget() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBudgetInput) => {
      requireOnline();
      const body: BudgetCreate = {
        ...input,
        id: uuidv7(),
        currency: "GHS",
        is_archived: false,
      };
      const { data, error, response } = await client.POST("/v1/budgets", {
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

      return ensureBudget(data, response.status);
    },
    onSuccess: () => invalidateBudgetQueries(queryClient),
  });
}

export function useUpdateBudget() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, changes }: UpdateBudgetInput) => {
      requireOnline();
      const { data, error, response } = await client.PATCH(
        "/v1/budgets/{budget_id}",
        {
          params: { path: { budget_id: id } },
          body: changes,
        },
      );
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureBudget(data, response.status);
    },
    onSuccess: () => invalidateBudgetQueries(queryClient),
  });
}

export function useDeleteBudget() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      requireOnline();
      const { error, response } = await client.DELETE(
        "/v1/budgets/{budget_id}",
        { params: { path: { budget_id: id } } },
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
    onSuccess: () => invalidateBudgetQueries(queryClient),
  });
}
