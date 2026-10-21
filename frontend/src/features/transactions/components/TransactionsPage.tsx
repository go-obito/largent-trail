"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Drawer from "@mui/material/Drawer";
import Fab from "@mui/material/Fab";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { ArrowLeft, Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { useAccounts } from "@/features/accounts/api";
import { categoryIcon } from "@/features/categories/categoryIcon";
import { useCategories } from "@/features/categories/api";
import { useMe } from "@/features/me/api";
import {
  useTransactions,
  type TransactionFilters,
} from "@/features/transactions/api";
import type { components } from "@/lib/api/schema";
import {
  addDaysToDate,
  dateInTimezone,
  formatDateInTimezone,
  isCalendarDate,
  startOfWeekInTimezone,
} from "@/lib/date";
import { formatGhs } from "@/lib/money";

type TransactionRead = components["schemas"]["TransactionRead"];
type TransactionKind = components["schemas"]["CategoryKind"];
type Period = "week" | "month" | "last30" | "all" | "custom";

const DEFAULT_TIMEZONE = "Africa/Accra";
const quickPeriods: { value: Exclude<Period, "custom">; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "last30", label: "Last 30 days" },
  { value: "all", label: "All" },
];

function getPeriod(value: string | null, hasDates: boolean): Period {
  if (
    value === "week" ||
    value === "month" ||
    value === "last30"
  ) {
    return value;
  }
  if (value === "custom") {
    return hasDates ? "custom" : "all";
  }
  if (value === "all") {
    return hasDates ? "custom" : "all";
  }

  return hasDates ? "custom" : "all";
}

function getDateRange(period: Exclude<Period, "custom">, today: string) {
  if (period === "week") {
    return { from: startOfWeekInTimezone(today), to: today };
  }
  if (period === "month") {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }
  if (period === "last30") {
    return { from: addDaysToDate(today, -29), to: today };
  }
  return { from: null, to: null };
}

function groupTransactions(transactions: TransactionRead[]) {
  const groups = new Map<string, TransactionRead[]>();
  for (const transaction of transactions) {
    const group = groups.get(transaction.occurred_on);
    if (group) {
      group.push(transaction);
    } else {
      groups.set(transaction.occurred_on, [transaction]);
    }
  }
  return [...groups.entries()];
}

export function TransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const me = useMe();
  const accounts = useAccounts();
  const categories = useCategories();
  const timezone = me.data?.timezone || DEFAULT_TIMEZONE;
  const today = dateInTimezone(new Date(), timezone);

  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");
  let from = isCalendarDate(rawFrom) ? rawFrom : undefined;
  let to = isCalendarDate(rawTo) ? rawTo : undefined;
  if (from && to && from > to) {
    from = undefined;
    to = undefined;
  }

  const rawKind = searchParams.get("kind");
  const kind: TransactionKind | undefined =
    rawKind === "income" || rawKind === "expense" ? rawKind : undefined;
  const accountId = searchParams.get("account_id") || undefined;
  const categoryId = searchParams.get("category_id") || undefined;
  const period = getPeriod(searchParams.get("period"), Boolean(from || to));
  const filters = useMemo<TransactionFilters>(
    () => ({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(kind ? { kind } : {}),
      ...(accountId ? { account_id: accountId } : {}),
      ...(categoryId ? { category_id: categoryId } : {}),
    }),
    [accountId, categoryId, from, kind, to],
  );
  const transactionsQuery = useTransactions(filters);
  const transactionPages = transactionsQuery.data?.pages;
  const transactions = useMemo(
    () => transactionPages?.flatMap((page) => page.items) ?? [],
    [transactionPages],
  );
  const groups = useMemo(() => groupTransactions(transactions), [transactions]);
  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = transactionsQuery;
  const filterCount =
    Number(period !== "all") +
    Number(Boolean(kind)) +
    Number(Boolean(accountId)) +
    Number(Boolean(categoryId));
  const header = (
    <header className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Activity
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Transactions
        </h1>
      </div>
      <Button
        className="hidden md:inline-flex"
        component={Link}
        href="/transactions/new"
        startIcon={<Plus aria-hidden="true" size={18} />}
        sx={{ minHeight: 44 }}
        variant="contained"
      >
        Add
      </Button>
    </header>
  );
  const addFab = (
    <Fab
      aria-label="Add transaction"
      className="fixed right-5 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-10 md:hidden"
      color="primary"
      component={Link}
      href="/transactions/new"
    >
      <Plus aria-hidden="true" />
    </Fab>
  );

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
      }
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const clearFilters = () => {
    updateQuery({
      period: null,
      from: null,
      to: null,
      kind: null,
      account_id: null,
      category_id: null,
    });
  };

  const selectPeriod = (nextPeriod: Exclude<Period, "custom">) => {
    const range = getDateRange(nextPeriod, today);
    updateQuery({ period: nextPeriod, from: range.from, to: range.to });
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (
      !sentinel ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => entry.isIntersecting) &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          void fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
  ]);

  if (transactionsQuery.isPending && !transactionsQuery.data) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingSkeleton label="Loading transactions" rows={5} />
        {addFab}
      </div>
    );
  }

  if (transactionsQuery.isError && !transactionsQuery.data) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState onRetry={() => void transactionsQuery.refetch()} />
        {addFab}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4">
      {header}

      <section aria-label="Transaction filters" className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {quickPeriods.map(({ value, label }) => (
            <button
              key={value}
              aria-pressed={period === value}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                period === value
                  ? "border-primary bg-selected text-foreground"
                  : "border-outline bg-panel text-muted hover:bg-panel-raised"
              }`}
              onClick={() => selectPeriod(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <ToggleButtonGroup
            aria-label="Transaction type"
            exclusive
            onChange={(_, value: TransactionKind | null) =>
              updateQuery({ kind: value })
            }
            size="small"
            value={kind ?? "all"}
          >
            <ToggleButton aria-label="All transactions" value="all">
              All
            </ToggleButton>
            <ToggleButton aria-label="Income transactions" value="income">
              Income
            </ToggleButton>
            <ToggleButton aria-label="Expense transactions" value="expense">
              Expense
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            aria-label={`Open filters${filterCount ? `, ${filterCount} active` : ""}`}
            onClick={() => setFiltersOpen(true)}
            startIcon={<SlidersHorizontal aria-hidden="true" size={18} />}
            sx={{ minHeight: 44, flexShrink: 0 }}
            variant="outlined"
          >
            Filters
            {filterCount > 0 && (
              <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
                {filterCount}
              </span>
            )}
          </Button>
        </div>
      </section>

      {transactionsQuery.isError && transactionsQuery.data && (
        <Alert severity="info">
          Showing saved transactions. They couldn&apos;t be refreshed just now.
        </Alert>
      )}

      {transactions.length === 0 ? (
        filterCount > 0 ? (
          <EmptyState
            title="No results"
            description="No transactions match these filters. Clear them to see all activity."
          >
            <Button
              className="mt-4"
              onClick={clearFilters}
              sx={{ minHeight: 44 }}
              variant="outlined"
            >
              Clear filters
            </Button>
          </EmptyState>
        ) : (
          <EmptyState
            title="No transactions yet"
            description="Add your first transaction to start keeping track of your money."
          >
            <Button
              className="mt-4"
              component={Link}
              href="/transactions/new"
              startIcon={<Plus aria-hidden="true" size={18} />}
              sx={{ minHeight: 44 }}
              variant="contained"
            >
              Add transaction
            </Button>
          </EmptyState>
        )
      ) : (
        <div className="space-y-5">
          {groups.map(([date, dayTransactions]) => {
            const yesterday = addDaysToDate(today, -1);
            const title =
              date === today
                ? "Today"
                : date === yesterday
                  ? "Yesterday"
                  : formatDateInTimezone(date, timezone, true);

            return (
              <section key={date} aria-label={title}>
                <h2 className="sticky top-0 z-10 -mx-1 bg-page/95 px-1 py-2 text-sm font-semibold text-muted backdrop-blur">
                  {title}
                </h2>
              <ul className="card-surface divide-y divide-outline px-4">
                  {dayTransactions.map((transaction) => {
                    const isIncome = transaction.kind === "income";
                    const Icon = categoryIcon(
                      transaction.category_name || "",
                      categories.data?.find(
                        (category) => category.id === transaction.category_id,
                      )?.icon ?? null,
                    );

                    return (
                      <li key={transaction.id}>
                        <Link
                          aria-label={`Edit ${transaction.category_name || "uncategorized transaction"} for ${formatGhs(Math.abs(transaction.amount_minor))}`}
                          className="flex min-h-[76px] items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          href={`/transactions/${transaction.id}/edit`}
                        >
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-selected text-foreground">
                            <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-foreground">
                              {transaction.category_name || "Uncategorized"}
                            </span>
                            {transaction.note && (
                              <span className="mt-0.5 block truncate text-sm text-muted">
                                {transaction.note}
                              </span>
                            )}
                            <span className="mt-0.5 block truncate text-sm text-muted">
                              {transaction.account_name}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 text-right font-semibold ${
                              isIncome
                                ? "text-status-success"
                                : "text-status-error"
                            }`}
                          >
                            {isIncome ? "+" : "−"}
                            {formatGhs(Math.abs(transaction.amount_minor))}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="flex flex-col items-center gap-3 py-2">
          {transactionsQuery.isFetchingNextPage && (
            <p
              aria-live="polite"
              className="flex items-center gap-2 text-sm text-muted"
              role="status"
            >
              <CircularProgress aria-label="Loading more transactions" size={18} />
              Loading more transactions…
            </p>
          )}
          {transactionsQuery.isFetchNextPageError && (
            <Button
              onClick={() => void transactionsQuery.fetchNextPage()}
              sx={{ minHeight: 44 }}
              variant="outlined"
            >
              Try loading more
            </Button>
          )}
          {transactionsQuery.hasNextPage && (
            <>
              <div aria-hidden="true" className="h-px w-full" ref={sentinelRef} />
              <Button
                disabled={transactionsQuery.isFetchingNextPage}
                onClick={() => void transactionsQuery.fetchNextPage()}
                sx={{ minHeight: 44 }}
                variant="outlined"
              >
                Load more
              </Button>
            </>
          )}
          {!transactionsQuery.hasNextPage && (
            <p className="text-sm text-muted">You&apos;re all caught up</p>
          )}
        </div>
      )}

      {addFab}

      <Drawer
        anchor="bottom"
        onClose={() => setFiltersOpen(false)}
        open={filtersOpen}
      >
        <div className="mx-auto max-h-[85dvh] w-full max-w-[640px] overflow-y-auto rounded-t-3xl bg-panel p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-foreground">Filters</h2>
            <Button
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
              startIcon={<ArrowLeft aria-hidden="true" size={18} />}
              sx={{ minHeight: 44 }}
            >
              Done
            </Button>
          </div>
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                fullWidth
                label="From"
                onChange={(event) => {
                  const nextFrom = event.target.value || null;
                  updateQuery({
                    from: nextFrom,
                    period: nextFrom || to ? "custom" : "all",
                  });
                }}
                slotProps={{
                  htmlInput: { max: to },
                  inputLabel: { shrink: true },
                }}
                type="date"
                value={from ?? ""}
              />
              <TextField
                fullWidth
                label="To"
                onChange={(event) => {
                  const nextTo = event.target.value || null;
                  updateQuery({
                    to: nextTo,
                    period: nextTo || from ? "custom" : "all",
                  });
                }}
                slotProps={{
                  htmlInput: { min: from },
                  inputLabel: { shrink: true },
                }}
                type="date"
                value={to ?? ""}
              />
            </div>

            {accounts.isError && (
              <Alert
                action={
                  <Button
                    color="inherit"
                    onClick={() => void accounts.refetch()}
                    size="small"
                  >
                    Retry
                  </Button>
                }
                severity="error"
              >
                Accounts couldn&apos;t be loaded.
              </Alert>
            )}
            <FormControl fullWidth disabled={!accounts.isSuccess}>
              <InputLabel id="transaction-account-label">Account</InputLabel>
              <Select
                id="transaction-account"
                label="Account"
                labelId="transaction-account-label"
                onChange={(event) =>
                  updateQuery({ account_id: event.target.value || null })
                }
                value={accountId ?? ""}
              >
                <MenuItem value="">All accounts</MenuItem>
                {accounts.data?.map((account) => (
                  <MenuItem key={account.id} value={account.id}>
                    {account.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {categories.isError && (
              <Alert
                action={
                  <Button
                    color="inherit"
                    onClick={() => void categories.refetch()}
                    size="small"
                  >
                    Retry
                  </Button>
                }
                severity="error"
              >
                Categories couldn&apos;t be loaded.
              </Alert>
            )}
            <FormControl fullWidth disabled={!categories.isSuccess}>
              <InputLabel id="transaction-category-label">Category</InputLabel>
              <Select
                id="transaction-category"
                label="Category"
                labelId="transaction-category-label"
                onChange={(event) =>
                  updateQuery({ category_id: event.target.value || null })
                }
                value={categoryId ?? ""}
              >
                <MenuItem value="">All categories</MenuItem>
                {categories.data?.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              fullWidth
              onClick={clearFilters}
              sx={{ minHeight: 44 }}
              variant="outlined"
            >
              Clear all
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
