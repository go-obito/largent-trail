"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, createApiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

const meQueryKey = ["me"] as const;

type UserRead = components["schemas"]["UserRead"];
type UserUpdate = components["schemas"]["UserUpdate"];

function useApiClient() {
  const { getToken } = useAuth();
  const clerk = useClerk();

  return useMemo(
    () => createApiClient(getToken, () => clerk.redirectToSignIn()),
    [clerk, getToken],
  );
}

function ensureMeData(data: UserRead | undefined, status: number): UserRead {
  if (data === undefined) {
    throw new ApiError(status, null, "The API response did not include user data.");
  }

  return data;
}

export function useMe() {
  const client = useApiClient();

  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => {
      const { data, error, response } = await client.GET("/v1/me");
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
        );
      }

      return ensureMeData(data, response.status);
    },
  });
}

export function useUpdateMe() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: UserUpdate) => {
      const { data, error, response } = await client.PATCH("/v1/me", {
        body: update,
      });
      if (error) {
        throw new ApiError(
          response.status,
          null,
          response.statusText || "The API request failed.",
        );
      }

      return ensureMeData(data, response.status);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}
