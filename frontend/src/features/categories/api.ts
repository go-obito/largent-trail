"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, createApiClient } from "@/lib/api/client";
import { requireOnline } from "@/lib/api/offline";
import type { components, paths } from "@/lib/api/schema";
import { uuidv7 } from "@/lib/uuid";

type CategoryCreate = components["schemas"]["CategoryCreate"];
type CategoryRead = components["schemas"]["CategoryRead"];
type CategoryPage = components["schemas"]["CategoryPage"];
type CategoryUpdate = components["schemas"]["CategoryUpdate"];
type CategoryKind = components["schemas"]["CategoryKind"];
type CategoryQuery = NonNullable<
  paths["/v1/categories"]["get"]["parameters"]["query"]
>;
type CategoryDeleteQuery = NonNullable<
  paths["/v1/categories/{category_id}"]["delete"]["parameters"]["query"]
>;
type ChangedFields<T> = {
  [Key in keyof T]?: NonNullable<T[Key]>;
};

export type CreateCategoryInput = Pick<CategoryCreate, "kind" | "name"> & {
  id?: string;
  icon?: CategoryCreate["icon"];
  is_archived?: boolean;
  position?: number;
};
export type UpdateCategoryInput = {
  id: string;
  changes: ChangedFields<
    Pick<CategoryUpdate, "name" | "is_archived" | "position">
  > & { icon?: CategoryUpdate["icon"] };
};
export type DeleteCategoryInput = {
  id: string;
  reassignTo?: string;
};

export const SUPPORTS_CATEGORY_REASSIGN = false;

export const categoryKeys = {
  all: ["categories"] as const,
  list: (kind?: CategoryKind, includeArchived = false) =>
    ["categories", "list", { kind, includeArchived }] as const,
};

const relatedInvalidationKeys = [
  categoryKeys.all,
  ["budgets"],
  ["transactions"],
  ["dashboard"],
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
  data: CategoryPage | undefined,
  status: number,
): CategoryPage {
  if (!data) {
    throw new ApiError(status, null, "The API response did not include categories.");
  }

  return data;
}

function ensureCategory(
  data: CategoryRead | undefined,
  status: number,
): CategoryRead {
  if (!data) {
    throw new ApiError(status, null, "The API response did not include the category.");
  }

  return data;
}

export function useCategories({
  kind,
  includeArchived = false,
}: {
  kind?: CategoryKind;
  includeArchived?: boolean;
} = {}) {
  const { client, isAuthReady } = useApiClient();

  return useQuery({
    queryKey: categoryKeys.list(kind, includeArchived),
    enabled: isAuthReady,
    queryFn: async () => {
      const categories: CategoryRead[] = [];
      let cursor: string | undefined;

      do {
        const query: CategoryQuery = {
          limit: 200,
          cursor,
          include_archived: includeArchived,
          ...(kind ? { kind } : {}),
        };
        const { data, error, response } = await client.GET("/v1/categories", {
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
        categories.push(...page.items);
        cursor = page.next_cursor ?? undefined;
      } while (cursor);

      return categories;
    },
  });
}

async function invalidateCategoryQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all(
    relatedInvalidationKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useCreateCategory() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      requireOnline();
      const body: CategoryCreate = {
        ...input,
        id: input.id ?? uuidv7(),
        is_archived: input.is_archived ?? false,
        position: input.position ?? 0,
      };
      const { data, error, response } = await client.POST("/v1/categories", {
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

      return ensureCategory(data, response.status);
    },
    onSuccess: () => invalidateCategoryQueries(queryClient),
  });
}

export function useUpdateCategory() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, changes }: UpdateCategoryInput) => {
      requireOnline();
      if (Object.keys(changes).length === 0) {
        throw new Error("Provide at least one changed category field.");
      }

      const { data, error, response } = await client.PATCH(
        "/v1/categories/{category_id}",
        { params: { path: { category_id: id } }, body: changes },
      );
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureCategory(data, response.status);
    },
    onSuccess: () => invalidateCategoryQueries(queryClient),
  });
}

export function useDeleteCategory() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reassignTo }: DeleteCategoryInput) => {
      requireOnline();
      if (reassignTo && !SUPPORTS_CATEGORY_REASSIGN) {
        throw new Error(
          "Category reassignment is not available yet. Archive the category instead.",
        );
      }

      const path = { category_id: id };
      const result =
        SUPPORTS_CATEGORY_REASSIGN && reassignTo
          ? await client.DELETE("/v1/categories/{category_id}", {
              params: {
                path,
                // The schema currently types this query as never; the false gate prevents sending it until regeneration.
                query: { reassign_to: reassignTo } as unknown as CategoryDeleteQuery,
              },
            })
          : await client.DELETE("/v1/categories/{category_id}", {
              params: { path },
            });
      const { error, response } = result;
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }
    },
    onSuccess: () => invalidateCategoryQueries(queryClient),
  });
}
