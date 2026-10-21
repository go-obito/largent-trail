"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, createApiClient } from "@/lib/api/client";
import { requireOnline } from "@/lib/api/offline";
import type { components, paths } from "@/lib/api/schema";
import { uuidv7 } from "@/lib/uuid";
import { budgetKeys, fetchBudgets } from "@/features/budgets/api";
import { budgetAlertMessage, worstBudgetEscalation } from "@/features/budgets/alerts";
import { showToast } from "@/lib/toast";

type TransactionCreate = components["schemas"]["TransactionCreate"];
type TransactionRead = components["schemas"]["TransactionRead"];
type TransactionPage = components["schemas"]["TransactionPage"];
type TransactionUpdate = components["schemas"]["TransactionUpdate"];
type TransactionQuery = NonNullable<
  paths["/v1/transactions"]["get"]["parameters"]["query"]
>;
export type TransactionFilters = Pick<
  TransactionQuery,
  "from" | "to" | "kind" | "account_id" | "category_id"
>;
export type CreateTransactionInput = Omit<TransactionCreate, "id">;
export type UpdateTransactionInput = {
  id: string;
  changes: TransactionUpdate;
};

const pageSize = (() => {
  const value = process.env.NEXT_PUBLIC_TX_PAGE_SIZE;
  if (value === undefined || value === "") {
    return 50;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("NEXT_PUBLIC_TX_PAGE_SIZE must be a positive integer.");
  }

  return parsed;
})();

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => ["transactions", "list"] as const,
  list: (filters: TransactionFilters) =>
    ["transactions", "list", filters] as const,
  detail: (id: string) => ["transactions", "detail", id] as const,
};

const relatedInvalidationKeys = [
  transactionKeys.all,
  ["dashboard"],
  ["accounts"],
  ["budgets"],
  ["reports"],
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

function ensurePage(
  data: TransactionPage | undefined,
  status: number,
): TransactionPage {
  if (!data) {
    throw new ApiError(
      status,
      null,
      "The API response did not include transactions.",
    );
  }

  return data;
}

function ensureTransaction(
  data: TransactionRead | undefined,
  status: number,
): TransactionRead {
  if (!data) {
    throw new ApiError(
      status,
      null,
      "The API response did not include the transaction.",
    );
  }

  return data;
}

async function invalidateTransactionQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  includeBudgets = true,
) {
  await Promise.all(
    relatedInvalidationKeys
      .filter((queryKey) => includeBudgets || queryKey[0] !== "budgets")
      .map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

type TransactionMutationContext = {
  budgetsBefore: BudgetRead[] | null;
};

type BudgetRead = components["schemas"]["BudgetRead"];

async function completeTransactionSave(
  client: ReturnType<typeof createApiClient>,
  queryClient: ReturnType<typeof useQueryClient>,
  budgetsBefore: BudgetRead[] | null,
  successMessage: string,
) {
  let escalation: BudgetRead | null = null;
  let budgetRefreshFailed = false;

  if (budgetsBefore) {
    try {
      const budgetsAfter = await queryClient.fetchQuery({
        queryKey: budgetKeys.list(),
        queryFn: () => fetchBudgets(client),
        staleTime: 0,
      });
      escalation = worstBudgetEscalation(budgetsBefore, budgetsAfter);
    } catch {
      budgetRefreshFailed = true;
    }
  }

  await invalidateTransactionQueries(queryClient, !budgetsBefore || budgetRefreshFailed);

  if (budgetRefreshFailed) {
    showToast(
      "Transaction saved, but budget alerts couldn't be refreshed.",
      "warning",
      8000,
    );
  } else if (escalation) {
    showToast(
      budgetAlertMessage(escalation, true),
      escalation.status === "over_limit" ? "error" : "warning",
      8000,
    );
  } else {
    showToast(successMessage, "success");
  }
}

export function useTransactions(filters: TransactionFilters = {}) {
  const { client, isAuthReady } = useApiClient();

  return useInfiniteQuery({
    queryKey: transactionKeys.list(filters),
    enabled: isAuthReady,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await client.GET("/v1/transactions", {
        params: {
          query: {
            ...filters,
            limit: pageSize,
            cursor: pageParam ?? undefined,
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

      return ensurePage(data, response.status);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useTransaction(id: string) {
  const { client, isAuthReady } = useApiClient();

  return useQuery({
    queryKey: transactionKeys.detail(id),
    enabled: isAuthReady && id.length > 0,
    queryFn: async () => {
      const { data, error, response } = await client.GET(
        "/v1/transactions/{transaction_id}",
        { params: { path: { transaction_id: id } } },
      );
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureTransaction(data, response.status);
    },
  });
}

export function useCreateTransaction() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async (input): Promise<TransactionMutationContext> => {
      requireOnline();
      const budgetsBefore =
        input.kind === "expense"
          ? await queryClient.ensureQueryData({
              queryKey: budgetKeys.list(),
              queryFn: () => fetchBudgets(client),
            })
          : null;
      return { budgetsBefore };
    },
    mutationFn: async (input: CreateTransactionInput) => {
      requireOnline();
      const { data, error, response } = await client.POST("/v1/transactions", {
        body: { ...input, id: uuidv7() },
      });
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureTransaction(data, response.status);
    },
    onSuccess: async (_transaction, _input, context) =>
      completeTransactionSave(
        client,
        queryClient,
        context?.budgetsBefore ?? null,
        "Transaction added",
      ),
  });
}

export function useUpdateTransaction() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async ({
      id,
      changes,
    }): Promise<TransactionMutationContext> => {
      requireOnline();
      const currentTransaction =
        changes.kind == null
          ? await queryClient.ensureQueryData({
              queryKey: transactionKeys.detail(id),
              queryFn: async () => {
                const { data, error, response } = await client.GET(
                  "/v1/transactions/{transaction_id}",
                  { params: { path: { transaction_id: id } } },
                );
                if (error) {
                  throw new ApiError(
                    response.status,
                    null,
                    response.statusText || "The API request failed.",
                    error,
                  );
                }
                return ensureTransaction(data, response.status);
              },
            })
          : null;
      const isExpense =
        changes.kind === "expense" ||
        (changes.kind == null && currentTransaction?.kind === "expense");
      const budgetsBefore = isExpense
        ? await queryClient.ensureQueryData({
            queryKey: budgetKeys.list(),
            queryFn: () => fetchBudgets(client),
          })
        : null;
      return { budgetsBefore };
    },
    mutationFn: async ({ id, changes }: UpdateTransactionInput) => {
      requireOnline();
      const { data, error, response } = await client.PATCH(
        "/v1/transactions/{transaction_id}",
        {
          params: { path: { transaction_id: id } },
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

      return ensureTransaction(data, response.status);
    },
    onSuccess: async (_transaction, _input, context) =>
      completeTransactionSave(
        client,
        queryClient,
        context?.budgetsBefore ?? null,
        "Transaction updated",
      ),
  });
}

export function useDeleteTransaction() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      requireOnline();
      const { error, response } = await client.DELETE(
        "/v1/transactions/{transaction_id}",
        { params: { path: { transaction_id: id } } },
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
    onSuccess: () => invalidateTransactionQueries(queryClient),
  });
}
