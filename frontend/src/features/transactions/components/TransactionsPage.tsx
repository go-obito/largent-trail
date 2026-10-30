"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Drawer from "@mui/material/Drawer";
import Fab from "@mui/material/Fab";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { ArrowLeft, Ellipsis, Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { EmptyState } from "@/components/states/EmptyState";
import { CategoryBadge } from "@/components/CategoryBadge";
import { LogoDevAttribution, MerchantLogo } from "@/components/brand/MerchantLogo";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { useAccounts } from "@/features/accounts/api";
import { useCategories } from "@/features/categories/api";
import { useMe } from "@/features/me/api";
import {
  useDeleteTransaction,
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
import { showToast } from "@/lib/toast";

type TransactionRead = components["schemas"]["TransactionRead"];
type TransactionKind = components["schemas"]["CategoryKind"];
type Period = "week" | "month" | "last30" | "all" | "custom";

const DEFAULT_TIMEZONE = "Africa/Accra";
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

function transactionTime(createdAt: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

export function TransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [actionTransaction, setActionTransaction] =
    useState<TransactionRead | null>(null);
  const [deleteTransaction, setDeleteTransaction] =
    useState<TransactionRead | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
  const deleteMutation = useDeleteTransaction();
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-muted">
          View, add and manage all your transactions.
        </p>
      </div>
      <Button
        className="hidden md:inline-flex"
        component={Link}
        href="/transactions/new"
        startIcon={<Plus aria-hidden="true" size={18} />}
        sx={{ minHeight: 44 }}
        variant="contained"
      >
        Add Transaction
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

  const openActions = (
    event: MouseEvent<HTMLElement>,
    transaction: TransactionRead,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setActionTransaction(transaction);
    setMenuAnchor(event.currentTarget);
  };

  const confirmDelete = async () => {
    if (!deleteTransaction) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deleteTransaction.id);
      setDeleteTransaction(null);
      showToast("Transaction deleted", "success");
    } catch {
      setDeleteError("We couldn't delete this transaction. Please try again.");
    }
  };

  const filterControls = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <ToggleButtonGroup
        aria-label="Transaction type"
        exclusive
        onChange={(_, value: TransactionKind | "all" | null) =>
          updateQuery({ kind: value === "all" ? null : value })
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
      <div className="flex items-center gap-2">
        <FormControl size="small" sx={{ minWidth: 148 }}>
          <Select
            aria-label="Transaction period"
            onChange={(event) => {
              const value = event.target.value as Period;
              if (value === "custom") {
                setFiltersOpen(true);
              } else {
                selectPeriod(value);
              }
            }}
            value={period}
          >
            <MenuItem value="week">This week</MenuItem>
            <MenuItem value="month">This month</MenuItem>
            <MenuItem value="last30">Last 30 days</MenuItem>
            <MenuItem value="all">All time</MenuItem>
            <MenuItem value="custom">Custom range</MenuItem>
          </Select>
        </FormControl>
        <Button
          aria-label={`Open filters${filterCount ? `, ${filterCount} active` : ""}`}
          className="hidden md:inline-flex"
          onClick={(event) => setFilterAnchor(event.currentTarget)}
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
        <Button
          aria-label={`Open filters${filterCount ? `, ${filterCount} active` : ""}`}
          className="md:hidden"
          onClick={() => setFiltersOpen(true)}
          sx={{ minWidth: 44, minHeight: 44 }}
          variant="outlined"
        >
          <SlidersHorizontal aria-hidden="true" size={18} />
        </Button>
      </div>
    </div>
  );

  const filterFields = (
    <div className="space-y-4">
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
            <Button color="inherit" onClick={() => void accounts.refetch()} size="small">
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
          onChange={(event) => updateQuery({ account_id: event.target.value || null })}
          value={accountId ?? ""}
        >
          <MenuItem value="">All accounts</MenuItem>
          {accounts.data?.map((account) => (
            <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {categories.isError && (
        <Alert
          action={
            <Button color="inherit" onClick={() => void categories.refetch()} size="small">
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
          onChange={(event) => updateQuery({ category_id: event.target.value || null })}
          value={categoryId ?? ""}
        >
          <MenuItem value="">All categories</MenuItem>
          {categories.data?.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              <span className="flex items-center gap-2">
                <CategoryBadge icon={category.icon} name={category.name} size={36} />
                {category.name}
              </span>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button fullWidth onClick={clearFilters} sx={{ minHeight: 44 }} variant="outlined">
        Clear all
      </Button>
    </div>
  );

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
        {transactions.length > 0 && <LogoDevAttribution className="py-2 text-center" />}

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
        {filterControls}
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
        <div className="hidden space-y-5 lg:block">
          {groups.map(([date, dayTransactions]) => {
            const yesterday = addDaysToDate(today, -1);
            const title =
              date === today
                ? "Today"
                : date === yesterday
                  ? "Yesterday"
                  : formatDateInTimezone(date, timezone);

            return (
              <section key={date} aria-label={title}>
                <h2 className="sticky top-0 z-10 -mx-1 bg-page/95 px-1 py-2 text-sm font-semibold text-muted backdrop-blur">
                  {title}
                </h2>
              <div className="card-surface overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="border-b border-outline text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      <th className="w-14 px-2 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline">
                  {dayTransactions.map((transaction) => {
                    const isIncome = transaction.kind === "income";
                    const category = categories.data?.find(
                      (item) => item.id === transaction.category_id,
                    );

                    return (
                      <tr
                        key={transaction.id}
                        className="cursor-pointer hover:bg-panel-raised/60"
                        onClick={() => router.push(`/transactions/${transaction.id}/edit`)}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">
                          {formatDateInTimezone(transaction.occurred_on, timezone)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            className="flex min-h-11 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-focus"
                            href={`/transactions/${transaction.id}/edit`}
                          >
                            <MerchantLogo categoryIcon={category?.icon} categoryName={transaction.category_name || "Uncategorized"} merchantName={transaction.note || ""} size={36} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-foreground">{transaction.note || transaction.category_name || "Uncategorized"}</span>
                              <span className="block truncate text-sm text-muted">{transaction.account_name}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted">{transaction.category_name || "Uncategorized"}</td>
                        <td className={`money whitespace-nowrap px-4 py-3 text-right font-semibold ${isIncome ? "text-status-success" : "text-status-error"}`}>
                          {isIncome ? "+" : "−"}{formatGhs(Math.abs(transaction.amount_minor))}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <Button aria-label={`Actions for ${transaction.category_name || "transaction"}`} onClick={(event) => openActions(event, transaction)} sx={{ minWidth: 44, minHeight: 44 }}>
                            <Ellipsis aria-hidden="true" size={18} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
              </section>
            );
          })}
        </div>
      )}

      {transactions.length > 0 && (
        <div className="space-y-5 lg:hidden">
          {groups.map(([date, dayTransactions]) => {
            const yesterday = addDaysToDate(today, -1);
            const title =
              date === today ? "Today" : date === yesterday ? "Yesterday" : formatDateInTimezone(date, timezone);
            return (
              <section key={date} aria-label={title}>
                <h2 className="sticky top-0 z-10 -mx-1 bg-page/95 px-1 py-2 text-sm font-semibold text-muted backdrop-blur">{title}</h2>
                <ul className="card-surface divide-y divide-outline px-4">
                  {dayTransactions.map((transaction) => {
                    const category = categories.data?.find((item) => item.id === transaction.category_id);
                    const isIncome = transaction.kind === "income";
                    return (
                      <li key={transaction.id} className="flex min-h-[76px] items-center gap-2 py-2">
                        <Link className="flex min-w-0 flex-1 items-center gap-3 py-1 focus-visible:outline-2 focus-visible:outline-focus" href={`/transactions/${transaction.id}/edit`}>
                          <MerchantLogo categoryIcon={category?.icon} categoryName={transaction.category_name || "Uncategorized"} merchantName={transaction.note || ""} size={44} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-foreground">{transaction.note || transaction.category_name || "Uncategorized"}</span>
                            <span className="mt-0.5 block truncate text-sm text-muted">{transaction.category_name || "Uncategorized"} · {transactionTime(transaction.created_at, timezone)}</span>
                          </span>
                          <span className={`money shrink-0 text-right text-sm font-semibold ${isIncome ? "text-status-success" : "text-status-error"}`}>
                            {isIncome ? "+" : "−"}{formatGhs(Math.abs(transaction.amount_minor))}
                          </span>
                        </Link>
                        <Button aria-label={`Actions for ${transaction.category_name || "transaction"}`} onClick={(event) => openActions(event, transaction)} sx={{ minWidth: 40, minHeight: 44 }}>
                          <Ellipsis aria-hidden="true" size={18} />
                        </Button>
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
        <div className="mx-auto max-h-[85dvh] w-full max-w-full overflow-y-auto rounded-t-3xl bg-panel p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
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
          <div className="mt-5">{filterFields}</div>
        </div>
      </Drawer>

      <Popover
        anchorEl={filterAnchor}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        onClose={() => setFilterAnchor(null)}
        open={Boolean(filterAnchor)}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <div className="w-[340px] space-y-4 p-5">{filterFields}</div>
      </Popover>

      <Menu anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} open={Boolean(menuAnchor)}>
        <MenuItem
          component={Link}
          href={actionTransaction ? `/transactions/${actionTransaction.id}/edit` : "/transactions"}
          onClick={() => setMenuAnchor(null)}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDeleteError(null);
            setDeleteTransaction(actionTransaction);
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      <Dialog
        onClose={() => !deleteMutation.isPending && setDeleteTransaction(null)}
        open={Boolean(deleteTransaction)}
      >
        <DialogTitle>Delete transaction?</DialogTitle>
        <DialogContent>
          <p className="text-sm text-muted">This transaction will be permanently deleted.</p>
          {deleteError && <Alert className="mt-3" severity="error">{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={deleteMutation.isPending} onClick={() => setDeleteTransaction(null)}>Cancel</Button>
          <Button color="error" disabled={deleteMutation.isPending} onClick={() => void confirmDelete()} variant="contained">
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
