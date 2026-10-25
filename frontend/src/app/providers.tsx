"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { del, get, set } from "idb-keyval";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  type PersistedClient,
  type Persister,
} from "@tanstack/react-query-persist-client";
import { ThemeProvider } from "@mui/material/styles";
import { useColorScheme } from "@mui/material/styles";
import { theme } from "../styles/theme";

const QUERY_CACHE_KEY = "largent-query-cache";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

function storageKey(userId: string) {
  return `${QUERY_CACHE_KEY}:${userId}`;
}

export function clearPersistedQueryCache(userId: string) {
  return del(storageKey(userId));
}

function createPersister(userId: string): Persister {
  const key = storageKey(userId);

  return {
    persistClient: async (client: PersistedClient) => set(key, client),
    restoreClient: async () => get<PersistedClient | undefined>(key),
    removeClient: async () => del(key),
  };
}

function QueryPersistence({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [queryClient] = useState(createQueryClient);
  const lastUserId = useRef<string | null>(null);
  const persister = useMemo(
    () => (userId ? createPersister(userId) : null),
    [userId],
  );

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const previousUserId = lastUserId.current;
    if (previousUserId && previousUserId !== userId) {
      queryClient.clear();
      void del(storageKey(previousUserId)).catch((error: unknown) => {
        console.error("Failed to clear the signed-out user's query cache.", error);
      });
    }

    if (!isSignedIn || !userId) {
      queryClient.clear();
      lastUserId.current = null;
      return;
    }

    lastUserId.current = userId;
  }, [isLoaded, isSignedIn, queryClient, userId]);

  if (isLoaded && isSignedIn && userId && persister) {
    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
        onError={() => {
          console.error("Failed to restore or persist the query cache.");
        }}
      >
        {children}
      </PersistQueryClientProvider>
    );
  }

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function ThemePreferenceSync() {
  const { mode } = useColorScheme();

  useEffect(() => {
    if (!mode) return;
    const root = document.documentElement;
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const updateThemeColor = (dark: boolean) => {
      root.style.colorScheme = dark ? "dark" : "light";
      if (meta) meta.content = dark ? "#111521" : "#F4F6FB";
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => updateThemeColor(mode === "system" ? media.matches : mode === "dark");
    update();
    if (mode === "system") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
  }, [mode]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ThemeProvider
        theme={theme}
        defaultMode="system"
        modeStorageKey="largent-theme"
        disableTransitionOnChange
      >
        <ThemePreferenceSync />
        <Suspense
          fallback={
            <main
              aria-busy="true"
              aria-live="polite"
              className="flex min-h-dvh items-center justify-center bg-page px-5 text-center text-foreground"
            >
              <p>Loading Largent...</p>
            </main>
          }
        >
          <QueryPersistence>{children}</QueryPersistence>
        </Suspense>
      </ThemeProvider>
    </ClerkProvider>
  );
}
