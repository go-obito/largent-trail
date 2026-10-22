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
import type { components } from "@/lib/api/schema";

type NeedCreate = components["schemas"]["NeedCreate"];
type NeedList = components["schemas"]["NeedList"];
type NeedRead = components["schemas"]["NeedRead"];
type NeedSummary = components["schemas"]["NeedSummary"];
type NeedUpdate = components["schemas"]["NeedUpdate"];
type AllocationPage = components["schemas"]["AllocationPage"];

export type CreateNeedInput = Omit<NeedCreate, "id"> & { id: string };
export type UpdateNeedInput = { id: string; changes: NeedUpdate };
export type AllocateInput = {
  needId: string;
  id: string;
  kind: components["schemas"]["AllocationKind"];
  amount_minor: number;
};
export type DeleteNeedInput = {
  id: string;
  reconcile?: "release" | "purchased";
  account_id?: string;
  category_id?: string;
  occurred_on?: string;
};

export const needKeys = {
  all: ["needs"] as const,
  list: () => ["needs", "list"] as const,
  summary: () => ["needs", "summary"] as const,
  detail: (id: string) => ["needs", "detail", id] as const,
  allocations: (id: string) => ["needs", "allocations", id] as const,
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

function ensureNeedList(
  data: NeedList | undefined,
  status: number,
): NeedList {
  if (!data) {
    throw new ApiError(status, null, "The API response did not include needs.");
  }

  return data;
}

function ensureNeedSummary(
  data: NeedSummary | undefined,
  status: number,
): NeedSummary {
  if (!data) {
    throw new ApiError(
      status,
      null,
      "The API response did not include the needs summary.",
    );
  }

  return data;
}

function ensureNeed(data: NeedRead | undefined, status: number): NeedRead {
  if (!data) {
    throw new ApiError(status, null, "The API response did not include the need.");
  }

  return data;
}

function ensureAllocationPage(
  data: AllocationPage | undefined,
  status: number,
): AllocationPage {
  if (!data) {
    throw new ApiError(
      status,
      null,
      "The API response did not include allocation history.",
    );
  }

  return data;
}

async function invalidateNeedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all(
    [needKeys.all, ["dashboard"]].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useNeeds() {
  const { client, isAuthReady } = useApiClient();

  return useQuery({
    queryKey: needKeys.list(),
    enabled: isAuthReady,
    queryFn: async () => {
      const { data, error, response } = await client.GET("/v1/needs");
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureNeedList(data, response.status).items;
    },
  });
}

export function useNeedsSummary() {
  const { client, isAuthReady } = useApiClient();

  return useQuery({
    queryKey: needKeys.summary(),
    enabled: isAuthReady,
    queryFn: async () => {
      const { data, error, response } = await client.GET("/v1/needs/summary");
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureNeedSummary(data, response.status);
    },
  });
}

export function useNeed(id: string) {
  const { client, isAuthReady } = useApiClient();

  return useQuery({
    queryKey: needKeys.detail(id),
    enabled: isAuthReady && id.length > 0,
    queryFn: async () => {
      const { data, error, response } = await client.GET(
        "/v1/needs/{need_id}",
        { params: { path: { need_id: id } } },
      );
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureNeed(data, response.status);
    },
  });
}

export function useCreateNeed() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNeedInput) => {
      requireOnline();
      const { data, error, response } = await client.POST("/v1/needs", {
        body: input,
      });
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureNeed(data, response.status);
    },
    onSuccess: () => invalidateNeedQueries(queryClient),
  });
}

export function useUpdateNeed() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, changes }: UpdateNeedInput) => {
      requireOnline();
      const { data, error, response } = await client.PATCH(
        "/v1/needs/{need_id}",
        { params: { path: { need_id: id } }, body: changes },
      );
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureNeed(data, response.status);
    },
    onSuccess: () => invalidateNeedQueries(queryClient),
  });
}

export function useReorderNeeds() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      requireOnline();
      const { data, error, response } = await client.PUT("/v1/needs/order", {
        body: { ids },
      });
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
          error,
        );
      }

      return ensureNeedList(data, response.status).items;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: needKeys.list() });
      const previousNeeds = queryClient.getQueryData<NeedRead[]>(
        needKeys.list(),
      );
      if (previousNeeds) {
        const byId = new Map(previousNeeds.map((need) => [need.id, need]));
        const reordered = ids.flatMap((id) => {
          const need = byId.get(id);
          return need ? [need] : [];
        });
        queryClient.setQueryData(needKeys.list(), reordered);
      }

      return { previousNeeds };
    },
    onError: async (_error, _ids, context) => {
      if (context?.previousNeeds) {
        queryClient.setQueryData(needKeys.list(), context.previousNeeds);
      }
      await invalidateNeedQueries(queryClient);
    },
    onSuccess: async (needs) => {
      queryClient.setQueryData(needKeys.list(), needs);
      await invalidateNeedQueries(queryClient);
    },
  });
}

export function useAllocate() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ needId, id, kind, amount_minor }: AllocateInput) => {
      requireOnline();
      const { data, error, response } = await client.POST(
        "/v1/needs/{need_id}/allocations",
        {
          params: { path: { need_id: needId } },
          body: { id, kind, amount_minor },
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

      return data;
    },
    onSuccess: () => invalidateNeedQueries(queryClient),
  });
}

export function useNeedAllocations(id: string) {
  const { client, isAuthReady } = useApiClient();

  return useInfiniteQuery({
    queryKey: needKeys.allocations(id),
    enabled: isAuthReady && id.length > 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error, response } = await client.GET(
        "/v1/needs/{need_id}/allocations",
        {
          params: {
            path: { need_id: id },
            query: { limit: 30, cursor: pageParam ?? undefined },
          },
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

      return ensureAllocationPage(data, response.status);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useDeleteNeed() {
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      reconcile,
      account_id,
      category_id,
      occurred_on,
    }: DeleteNeedInput) => {
      requireOnline();
      const { error, response } = await client.DELETE(
        "/v1/needs/{need_id}",
        {
          params: {
            path: { need_id: id },
            query: { reconcile, account_id, category_id, occurred_on },
          },
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
    },
    onSuccess: async (_data, input) => {
      await invalidateNeedQueries(queryClient);
      if (input.reconcile === "purchased") {
        await Promise.all(
          ["transactions", "accounts", "budgets", "reports"].map((key) =>
            queryClient.invalidateQueries({ queryKey: [key] }),
          ),
        );
      }
    },
  });
}
