"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Fab from "@mui/material/Fab";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { Ellipsis, Plus } from "lucide-react";
import { EmptyState } from "@/components/states/EmptyState";
import { CategoryBadge, categoryPresentation } from "@/components/CategoryBadge";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { SpendingOverviewCard } from "@/features/dashboard/components/SpendingOverviewCard";
import { useCategories } from "@/features/categories/api";
import { useReport, type ReportPeriod } from "@/features/reports/api";
import { useMe } from "@/features/me/api";
import {
  budgetPercent,
  budgetsNeedingAttention,
  periodRange,
  statusLabel,
  statusRank,
} from "@/features/budgets/helpers";
import {
  useBudgets,
  useDeleteBudget,
  useUpdateBudget,
} from "@/features/budgets/api";
import type { components } from "@/lib/api/schema";
import { todayInTz } from "@/lib/dates";
import { formatGhs } from "@/lib/money";
import { showToast } from "@/lib/toast";

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
  within: "",
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

function BudgetActions({
  budget,
  isOnline,
}: {
  budget: BudgetRead;
  isOnline: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const update = useUpdateBudget();
  const remove = useDeleteBudget();

  const archive = async () => {
    setActionError(null);
    try {
      await update.mutateAsync({
        id: budget.id,
        changes: { is_archived: !budget.is_archived },
      });
      setAnchor(null);
      showToast(budget.is_archived ? "Budget restored" : "Budget archived", "success");
    } catch {
      setActionError("We couldn't update this budget. Please try again.");
    }
  };

  const deleteBudget = async () => {
    setActionError(null);
    try {
      await remove.mutateAsync(budget.id);
      setConfirmDelete(false);
      showToast("Budget deleted", "success");
    } catch {
      setActionError("We couldn't delete this budget. Please try again.");
    }
  };

  return (
    <>
      <Button
        aria-label={`Actions for ${budget.category_name} budget`}
        disabled={!isOnline}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
      >
        <Ellipsis aria-hidden="true" size={18} />
      </Button>
      <Menu anchorEl={anchor} onClose={() => setAnchor(null)} open={Boolean(anchor)}>
        <MenuItem
          component={Link}
          href={`/budgets/${budget.id}/edit`}
          onClick={() => setAnchor(null)}
        >
          Edit
        </MenuItem>
        <MenuItem onClick={() => void archive()}>
          {budget.is_archived ? "Restore" : "Archive"}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setConfirmDelete(true);
          }}
        >
          Delete
        </MenuItem>
      </Menu>
      <Dialog
        onClose={() => !remove.isPending && setConfirmDelete(false)}
        open={confirmDelete}
      >
        <DialogTitle>Delete budget?</DialogTitle>
        <DialogContent>
          <p className="text-sm text-muted">
            This will permanently delete the {budget.category_name} budget.
          </p>
          {actionError && <p aria-live="polite" className="mt-3 text-sm text-alert" role="alert">{actionError}</p>}
        </DialogContent>
        <DialogActions>
          <Button disabled={remove.isPending} onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button color="error" disabled={!isOnline || remove.isPending} onClick={() => void deleteBudget()} variant="contained">
            {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
      {actionError && !confirmDelete && (
        <p aria-live="polite" className="mt-2 text-sm text-alert" role="alert">{actionError}</p>
      )}
    </>
  );
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
  isOnline,
}: {
  budget: BudgetRead;
  categories: ReturnType<typeof useCategories>["data"];
  timezone: string;
  isOnline: boolean;
}) {
  const iconKey =
    categories?.find((category) => category.id === budget.category_id)?.icon ??
    null;
  const categoryColor = categoryPresentation(budget.category_name, iconKey).color;
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
    <article className="card-surface p-5">
      <div className="flex items-start gap-3">
        <Link
          aria-label={`Edit ${budget.category_name} ${budget.period} budget`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href={`/budgets/${budget.id}/edit`}
        >
          <CategoryBadge icon={iconKey} name={budget.category_name} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-foreground">
              {budget.category_name}
            </span>
            <span className="mt-1 inline-flex rounded-full bg-panel-raised px-2.5 py-1 text-xs font-medium capitalize text-muted">
              {budget.period === "weekly" ? "Weekly" : "Monthly"}
            </span>
          </span>
        </Link>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusClass[budget.status]} ${tintClass[budget.status]}`}
        >
          {statusLabel(budget.status)}
        </span>
        <BudgetActions budget={budget} isOnline={isOnline} />
      </div>
      <Link
        aria-label={`View ${budget.category_name} budget details`}
        className="block rounded-xl focus-visible:outline-2 focus-visible:outline-focus"
        href={`/budgets/${budget.id}/edit`}
      >
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
            style={{
              width: `${barPercent}%`,
              ...(budget.status === "within" ? { backgroundColor: categoryColor } : {}),
            }}
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
  isOnline,
}: {
  budgets: BudgetRead[];
  categories: ReturnType<typeof useCategories>["data"];
  period: BudgetPeriod;
  timezone: string;
  isOnline: boolean;
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
              isOnline={isOnline}
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
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("month");
  const today = todayInTz(meQuery.data?.timezone || "Africa/Accra");
  const reportQuery = useReport(reportPeriod, today);
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Budgets
          </h1>
          <p className="mt-1 text-sm text-muted">
            Plan your spending and stay on track.
          </p>
        </div>
        <Button
          className="hidden md:inline-flex"
          disabled={!isOnline}
          onClick={addBudget}
          startIcon={<Plus aria-hidden="true" size={18} />}
          sx={{ minHeight: 44 }}
          variant="contained"
        >
          Add Budget
        </Button>
      </header>

      <SpendingOverviewCard
        data={reportQuery.data}
        isError={reportQuery.isError}
        isLoading={reportQuery.isPending}
        onPeriodChange={setReportPeriod}
        onRetry={() => void reportQuery.refetch()}
        period={reportPeriod}
      />

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
          <h2 className="text-lg font-bold text-foreground">Category Budgets</h2>
          <BudgetSection
            budgets={activeBudgets}
            categories={categoriesQuery.data}
            period="weekly"
            timezone={timezone}
            isOnline={isOnline}
          />
          <BudgetSection
            budgets={activeBudgets}
            categories={categoriesQuery.data}
            period="monthly"
            timezone={timezone}
            isOnline={isOnline}
          />
        </>
      )}

      {archivedBudgets.length > 0 && (
        <details className="card-surface p-5">
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
                isOnline={isOnline}
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
