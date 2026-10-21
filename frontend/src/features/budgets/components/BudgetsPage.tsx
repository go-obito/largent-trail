"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { createElement } from "react";
import Button from "@mui/material/Button";
import Fab from "@mui/material/Fab";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { useCategories } from "@/features/categories/api";
import { categoryIcon } from "@/features/categories/categoryIcon";
import { useMe } from "@/features/me/api";
import {
  budgetPercent,
  budgetsNeedingAttention,
  periodRange,
  statusLabel,
  statusRank,
} from "@/features/budgets/helpers";
import { useBudgets } from "@/features/budgets/api";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";

type BudgetRead = components["schemas"]["BudgetRead"];
type BudgetStatus = BudgetRead["status"];
type BudgetPeriod = BudgetRead["period"];
const noBudgets: BudgetRead[] = [];

const statusClass: Record<BudgetStatus, string> = {
  within: "text-status-success",
  near_limit: "text-status-warning",
  over_limit: "text-status-error",
};

const progressClass: Record<BudgetStatus, string> = {
  within: "bg-primary",
  near_limit: "bg-status-warning",
  over_limit: "bg-status-error",
};

const tintClass: Record<BudgetStatus, string> = {
  within: "bg-[color-mix(in_srgb,var(--color-success)_14%,var(--color-surface))]",
  near_limit: "bg-[color-mix(in_srgb,var(--color-warning)_14%,var(--color-surface))]",
  over_limit: "bg-[color-mix(in_srgb,var(--color-error)_14%,var(--color-surface))]",
};

function statusAttentionClass(status: BudgetStatus) {
  return status === "over_limit"
    ? "border-status-error bg-[color-mix(in_srgb,var(--color-error)_10%,var(--color-surface))]"
    : "border-status-warning bg-[color-mix(in_srgb,var(--color-warning)_10%,var(--color-surface))]";
}

function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);

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

  return isOnline;
}

function BudgetCard({
  budget,
  categories,
  timezone,
}: {
  budget: BudgetRead;
  categories: ReturnType<typeof useCategories>["data"];
  timezone: string;
}) {
  const iconKey =
    categories?.find((category) => category.id === budget.category_id)?.icon ??
    null;
  const Icon = categoryIcon(budget.category_name, iconKey);
  const percent = budgetPercent(budget.spent_minor, budget.limit_minor);
  const barPercent = Math.min(100, Math.max(0, percent));
  const isOver = budget.status === "over_limit";
  const difference = isOver
    ? Math.max(0, budget.spent_minor - budget.limit_minor)
    : Math.max(0, budget.limit_minor - budget.spent_minor);
  const range = periodRange(budget.period, timezone);
  const transactionsHref = {
    pathname: "/transactions",
    query: {
      category_id: budget.category_id,
      from: range.from,
      to: range.to,
    },
  };

  return (
    <article className="rounded-3xl border border-outline bg-panel p-5">
      <Link
        aria-label={`Edit ${budget.category_name} ${budget.period} budget`}
        className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        href={`/budgets/${budget.id}/edit`}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-selected text-foreground">
            {createElement(Icon, {
              "aria-hidden": true,
              size: 20,
              strokeWidth: 1.8,
            })}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-foreground">
              {budget.category_name}
            </span>
            <span className="mt-0.5 block text-sm capitalize text-muted">
              {budget.period}
            </span>
          </span>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClass[budget.status]} ${tintClass[budget.status]}`}
          >
            {statusLabel(budget.status)}
          </span>
        </div>
        <span className="mt-4 block text-sm font-medium text-foreground">
          {formatGhs(budget.spent_minor)} of {formatGhs(budget.limit_minor)}
        </span>
        <span
          aria-label={`${budget.category_name} budget progress`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={barPercent}
          className="mt-2 block h-2 overflow-hidden rounded-full bg-panel-raised"
          role="progressbar"
        >
          <span
            className={`block h-full rounded-full ${progressClass[budget.status]}`}
            style={{ width: `${barPercent}%` }}
          />
        </span>
        <span className="mt-2 flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-foreground">{percent}%</span>
          <span
            className={
              isOver ? "font-semibold text-status-error" : "text-muted"
            }
          >
            {formatGhs(difference)} {isOver ? "over" : "left"}
          </span>
        </span>
      </Link>
      <Link
        className="mt-4 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        href={transactionsHref}
      >
        View transactions
      </Link>
    </article>
  );
}

function BudgetSection({
  budgets,
  categories,
  period,
  timezone,
}: {
  budgets: BudgetRead[];
  categories: ReturnType<typeof useCategories>["data"];
  period: BudgetPeriod;
  timezone: string;
}) {
  const title = period === "weekly" ? "Weekly" : "Monthly";
  const periodBudgets = budgets.filter((budget) => budget.period === period);

  return (
    <section aria-labelledby={`budgets-${period}-heading`} className="space-y-3">
      <h2
        className="text-xs font-semibold uppercase tracking-[0.16em] text-muted"
        id={`budgets-${period}-heading`}
      >
        {title}
      </h2>
      {periodBudgets.length ? (
        <div className="space-y-3">
          {periodBudgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              categories={categories}
              timezone={timezone}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-outline bg-panel px-4 py-3 text-sm text-muted">
          No {title.toLowerCase()} budgets yet.
        </p>
      )}
    </section>
  );
}

export function BudgetsPage() {
  const router = useRouter();
  const isOnline = useConnectionStatus();
  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories("expense");
  const meQuery = useMe();
  const budgets = budgetsQuery.data ?? noBudgets;
  const activeBudgets = useMemo(
    () => budgets.filter((budget) => !budget.is_archived),
    [budgets],
  );
  const archivedBudgets = useMemo(
    () => budgets.filter((budget) => budget.is_archived),
    [budgets],
  );
  const attention = budgetsNeedingAttention(activeBudgets);
  const worstStatus = attention.reduce<BudgetStatus | null>(
    (worst, budget) =>
      !worst || statusRank(budget.status) > statusRank(worst)
        ? budget.status
        : worst,
    null,
  );
  const timezone = meQuery.data?.timezone || "Africa/Accra";
  const isPending = budgetsQuery.isPending && !budgetsQuery.data;

  if (isPending) {
    return <LoadingSkeleton label="Loading budgets" rows={4} />;
  }

  if (budgetsQuery.isError && !budgetsQuery.data) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Plan
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Budgets
          </h1>
        </header>
        <ErrorState onRetry={() => void budgetsQuery.refetch()} />
      </div>
    );
  }

  const addBudget = () => {
    if (isOnline) {
      router.push("/budgets/new");
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Plan
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Budgets
          </h1>
        </div>
        <Button
          className="hidden md:inline-flex"
          disabled={!isOnline}
          onClick={addBudget}
          startIcon={<Plus aria-hidden="true" size={18} />}
          sx={{ minHeight: 44 }}
          variant="contained"
        >
          Add budget
        </Button>
      </header>

      <aside className="rounded-3xl border border-outline bg-panel p-4 text-sm leading-6 text-muted">
        Weekly budgets set your daily spending target. Monthly budgets count
        toward it, spread over the month.
      </aside>

      {budgetsQuery.isError && budgetsQuery.data && (
        <p
          aria-live="polite"
          className="rounded-2xl border border-outline bg-panel-raised px-4 py-3 text-sm text-muted"
          role="status"
        >
          Showing saved budgets. They couldn&apos;t be refreshed just now.
        </p>
      )}

      {attention.length > 0 && worstStatus && (
        <Link
          className={`block rounded-2xl border px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${statusAttentionClass(worstStatus)}`}
          href={`/budgets/${attention[0].id}/edit`}
        >
          {attention.length === 1 && attention[0].status === "over_limit"
            ? "1 budget is over its limit"
            : `${attention.length} ${attention.length === 1 ? "budget needs" : "budgets need"} attention`}
        </Link>
      )}

      {categoriesQuery.isError && !categoriesQuery.data && (
        <ErrorState
          description="We couldn't load category icons. Your budgets are still available."
          onRetry={() => void categoriesQuery.refetch()}
        />
      )}

      {activeBudgets.length === 0 && archivedBudgets.length === 0 ? (
        <EmptyState
          description="Set a weekly budget to get a daily spending target"
          title="No budgets yet"
        >
          <Button
            className="mt-4"
            disabled={!isOnline}
            onClick={addBudget}
            sx={{ minHeight: 44 }}
            variant="contained"
          >
            Add budget
          </Button>
        </EmptyState>
      ) : (
        <>
          <BudgetSection
            budgets={activeBudgets}
            categories={categoriesQuery.data}
            period="weekly"
            timezone={timezone}
          />
          <BudgetSection
            budgets={activeBudgets}
            categories={categoriesQuery.data}
            period="monthly"
            timezone={timezone}
          />
        </>
      )}

      {archivedBudgets.length > 0 && (
        <details className="rounded-3xl border border-outline bg-panel p-5">
          <summary className="min-h-11 cursor-pointer font-semibold text-foreground">
            Archived ({archivedBudgets.length})
          </summary>
          <div className="mt-4 space-y-3">
            {archivedBudgets.map((budget) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                categories={categoriesQuery.data}
                timezone={timezone}
              />
            ))}
          </div>
        </details>
      )}

      <Fab
        aria-label="Add budget"
        className="fixed right-5 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-10 md:hidden"
        color="primary"
        disabled={!isOnline}
        onClick={addBudget}
      >
        <Plus aria-hidden="true" />
      </Fab>
    </div>
  );
}
