"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ellipsis,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { useMe } from "@/features/me/api";
import { useNeeds, useNeedsSummary, useReorderNeeds } from "@/features/needs/api";
import { AllocationDialog } from "@/features/needs/components/AllocationDialog";
import { NeedActivityDrawer } from "@/features/needs/components/NeedActivityDrawer";
import { NeedCard } from "@/features/needs/components/NeedCard";
import { NeedDeleteDialog } from "@/features/needs/components/NeedDeleteDialog";
import { needErrorMessage } from "@/features/needs/errors";
import { sortByPriority } from "@/features/needs/helpers";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";
import { showToast } from "@/lib/toast";

type NeedRead = components["schemas"]["NeedRead"];

export function NeedsPage() {
  const router = useRouter();
  const needsQuery = useNeeds();
  const summaryQuery = useNeedsSummary();
  const meQuery = useMe();
  const reorder = useReorderNeeds();
  const needs = needsQuery.data ?? [];
  const [isOnline, setIsOnline] = useState(true);
  const [headerMenuAnchor, setHeaderMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [allocationNeed, setAllocationNeed] = useState<NeedRead | null>(null);
  const [activityNeed, setActivityNeed] = useState<NeedRead | null>(null);
  const [deleteNeed, setDeleteNeed] = useState<NeedRead | null>(null);

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function reorderIds(ids: string[], successMessage: string) {
    try {
      await reorder.mutateAsync(ids);
      showToast(successMessage, "success");
    } catch (error) {
      showToast(
        needErrorMessage(error) ?? "The list changed. We've refreshed it.",
        "warning",
      );
    }
  }

  async function moveNeed(need: NeedRead, direction: "up" | "down") {
    const ids = needs.map((item) => item.id);
    const currentIndex = ids.indexOf(need.id);
    const nextIndex = currentIndex + (direction === "up" ? -1 : 1);
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ids.length) {
      return;
    }

    [ids[currentIndex], ids[nextIndex]] = [ids[nextIndex], ids[currentIndex]];
    await reorderIds(
      ids,
      direction === "up" ? "Need moved up" : "Need moved down",
    );
  }

  async function sortNeedsByPriority() {
    setHeaderMenuAnchor(null);
    const sortedIds = sortByPriority(needs);
    if (sortedIds.every((id, index) => id === needs[index]?.id)) {
      return;
    }
    await reorderIds(sortedIds, "Needs sorted by priority");
  }

  const priorityIds = sortByPriority(needs);
  const alreadyPrioritySorted = priorityIds.every(
    (id, index) => id === needs[index]?.id,
  );

  return (
    <div className="space-y-6 pb-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Needs
          </h1>
          <p className="mt-1 text-sm text-muted">
            Plan what you need and save toward it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            className="hidden md:inline-flex"
            component={Link}
            disabled={!isOnline}
            href="/needs/new"
            startIcon={<Plus aria-hidden="true" size={18} />}
            sx={{ minHeight: 44 }}
            variant="contained"
          >
            Add need
          </Button>
          <IconButton
            aria-label="Needs options"
            aria-expanded={Boolean(headerMenuAnchor)}
            aria-haspopup="menu"
            onClick={(event) => setHeaderMenuAnchor(event.currentTarget)}
            sx={{ minHeight: 44, minWidth: 44 }}
          >
            <Ellipsis aria-hidden="true" size={20} />
          </IconButton>
          <Menu
            anchorEl={headerMenuAnchor}
            onClose={() => setHeaderMenuAnchor(null)}
            open={Boolean(headerMenuAnchor)}
          >
            <MenuItem
              disabled={
                !isOnline ||
                reorder.isPending ||
                needs.length < 2 ||
                alreadyPrioritySorted
              }
              onClick={() => void sortNeedsByPriority()}
            >
              Sort by priority
            </MenuItem>
          </Menu>
        </div>
      </header>

      {needsQuery.isError && needsQuery.data && (
        <Alert aria-live="polite" severity="warning">
          Your saved needs are shown, but the latest refresh didn&apos;t work.
        </Alert>
      )}
      {needsQuery.isError && !needsQuery.data ? (
        <ErrorState
          onRetry={() => void needsQuery.refetch()}
          title="Needs couldn't be loaded"
          description="Check your connection and try again."
        />
      ) : needsQuery.isPending && !needsQuery.data ? (
        <div className="space-y-4">
          <LoadingSkeleton label="Loading needs summary" rows={1} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                aria-hidden="true"
                className="card-surface h-[310px] animate-pulse"
                key={index}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <NeedsSummary
            isError={summaryQuery.isError}
            isPending={summaryQuery.isPending}
            onRetry={() => void summaryQuery.refetch()}
            summary={summaryQuery.data}
          />
          {needs.length === 0 ? (
            <EmptyState
              title="Nothing on your list yet"
              description="Add the things you need, set a priority and start setting money aside."
            >
              <Button
                disabled={!isOnline}
                component={Link}
                href="/needs/new"
                startIcon={<Plus aria-hidden="true" size={18} />}
                sx={{ mt: 3, minHeight: 44 }}
                variant="contained"
              >
                Add need
              </Button>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {needs.map((need, index) => (
                <NeedCard
                  key={need.id}
                  count={needs.length}
                  index={index}
                  isOnline={isOnline}
                  isReorderPending={reorder.isPending}
                  need={need}
                  onAllocate={setAllocationNeed}
                  onDelete={setDeleteNeed}
                  onEdit={(need) => router.push(`/needs/${need.id}/edit`)}
                  onMove={(selectedNeed, direction) =>
                    void moveNeed(selectedNeed, direction)
                  }
                  onShowActivity={setActivityNeed}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Fab
        aria-label="Add need"
        className="fixed right-5 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 md:hidden"
        component={Link}
        disabled={!isOnline}
        href="/needs/new"
        color="primary"
        sx={{ minHeight: 56, minWidth: 56 }}
      >
        <Plus aria-hidden="true" size={22} />
      </Fab>

      {allocationNeed && (
        <AllocationDialog
          isOnline={isOnline}
          key={allocationNeed.id}
          need={allocationNeed}
          summary={summaryQuery.data}
          onClose={() => setAllocationNeed(null)}
        />
      )}
      {activityNeed && (
        <NeedActivityDrawer
          key={activityNeed.id}
          need={activityNeed}
          onClose={() => setActivityNeed(null)}
          timezone={meQuery.data?.timezone || "Africa/Accra"}
        />
      )}
      {deleteNeed && (
        <NeedDeleteDialog
          isOnline={isOnline}
          key={deleteNeed.id}
          need={deleteNeed}
          onClose={() => setDeleteNeed(null)}
          onDeleted={() => setDeleteNeed(null)}
        />
      )}
    </div>
  );
}

function NeedsSummary({
  isError,
  isPending,
  onRetry,
  summary,
}: {
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  summary?: components["schemas"]["NeedSummary"];
}) {
  if (isPending && !summary) {
    return <LoadingSkeleton label="Loading savings summary" rows={1} />;
  }
  if (isError && !summary) {
    return (
      <ErrorState
        onRetry={onRetry}
        title="Savings summary couldn't be loaded"
        description="Your needs are still available. Try refreshing the summary."
      />
    );
  }
  if (!summary) {
    return null;
  }

  return (
    <section aria-label="Needs savings summary" className="space-y-3">
      {summary.over_allocated && (
        <div
          className="flex items-start gap-3 rounded-2xl border border-status-warning bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--color-surface))] px-4 py-3"
          role="status"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-status-warning"
            size={19}
          />
          <p className="text-sm font-medium leading-6 text-foreground">
            You&apos;ve spent money that was set aside for your needs. Take some
            back to rebalance.
          </p>
        </div>
      )}
      {isError && (
        <Alert aria-live="polite" severity="warning">
          The latest savings summary couldn&apos;t be refreshed.
        </Alert>
      )}
      <div className="card-surface grid grid-cols-1 divide-y divide-outline p-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="pb-3 sm:pb-0 sm:pr-5">
          <p className="text-sm text-muted">Unallocated savings</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
            {formatGhs(summary.unallocated_minor)}
          </p>
        </div>
        <div className="pt-3 sm:pt-0 sm:pl-5">
          <p className="text-sm text-muted">Set aside of planned</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
            {formatGhs(summary.total_allocated_minor)} of{" "}
            {formatGhs(summary.total_target_minor)}
          </p>
        </div>
      </div>
    </section>
  );
}
