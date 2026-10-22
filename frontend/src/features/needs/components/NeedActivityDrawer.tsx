"use client";

import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import { ArrowDownToLine, ArrowUpFromLine, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { useNeedAllocations } from "@/features/needs/api";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";

type NeedRead = components["schemas"]["NeedRead"];

export function NeedActivityDrawer({
  need,
  onClose,
  timezone,
}: {
  need: NeedRead;
  onClose: () => void;
  timezone: string;
}) {
  const history = useNeedAllocations(need.id);
  const sentinel = useRef<HTMLDivElement>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = history;
  const entries = data?.pages.flatMap((page) => page.items) ?? [];
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }),
    [timezone],
  );

  useEffect(() => {
    const target = sentinel.current;
    if (
      !target ||
      !hasNextPage ||
      isFetchingNextPage ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (observations) => {
        if (observations.some((observation) => observation.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  ]);

  return (
    <Drawer
      anchor="right"
      onClose={onClose}
      open
      slotProps={{
        paper: {
          sx: {
            bgcolor: "background.paper",
            width: "min(100vw, 440px)",
          },
        },
      }}
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-outline px-5 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground" id="need-activity-title">
              Activity
            </h2>
            <p className="mt-1 truncate text-sm text-muted">{need.name}</p>
          </div>
          <IconButton
            aria-label="Close activity"
            onClick={onClose}
            sx={{ minHeight: 44, minWidth: 44, mt: -1, mr: -1 }}
          >
            <X aria-hidden="true" size={19} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {history.isPending && !history.data ? (
            <LoadingSkeleton label="Loading allocation activity" rows={4} />
          ) : history.isError && !history.data ? (
            <ErrorState
              onRetry={() => void history.refetch()}
              title="Activity couldn't be loaded"
              description="Check your connection and try again."
            />
          ) : entries.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Money set aside or taken back will appear here."
            />
          ) : (
            <ol className="divide-y divide-outline">
              {entries.map((entry) => (
                <li
                  className="flex items-center gap-3 py-4"
                  key={entry.id}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-selected-surface text-primary">
                    {entry.kind === "allocate" ? (
                      <ArrowDownToLine aria-hidden="true" size={18} />
                    ) : (
                      <ArrowUpFromLine aria-hidden="true" size={18} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {entry.kind === "allocate" ? "Set aside" : "Taken back"}
                    </p>
                    <time
                      className="mt-1 block text-xs text-muted"
                      dateTime={entry.created_at}
                    >
                      {dateFormatter.format(new Date(entry.created_at))}
                    </time>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-foreground">
                    {formatGhs(entry.amount_minor)}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {history.isError && history.data && (
            <p aria-live="polite" className="mt-3 text-sm text-status-error" role="alert">
              More activity couldn&apos;t be loaded.
            </p>
          )}
          {history.hasNextPage && (
            <div className="flex justify-center py-4" ref={sentinel}>
              <Button
                disabled={history.isFetchingNextPage}
                onClick={() => void history.fetchNextPage()}
              >
                {history.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
