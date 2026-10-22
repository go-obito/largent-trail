"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Fab from "@mui/material/Fab";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountTypeBadge } from "@/components/AccountTypeBadge";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";
import { AccountActions } from "./AccountActions";
import { AccountFormDialog } from "./AccountFormDialog";
import { useAccounts, useAccountsSummary } from "../api";

type AccountRead = components["schemas"]["AccountRead"];
type AccountType = components["schemas"]["AccountType"];

const accountTypeLabels: Record<AccountType, string> = {
  cash: "Cash account",
  bank: "Bank account",
  mobile_money: "Mobile money account",
  other: "Other account",
};

type AccountsPageProps = {
  homeTotalBalanceMinor?: number;
  isHomeBalanceError: boolean;
  isHomeBalanceFetching: boolean;
  onRetryHomeBalance: () => void;
};

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

function BalanceAmount({ amount }: { amount: number }) {
  const isNegative = amount < 0;

  return (
    <div>
      <p
        className={`money text-xl font-bold ${
          isNegative ? "text-status-error" : "text-foreground"
        }`}
      >
        {isNegative ? `−${formatGhs(Math.abs(amount))}` : formatGhs(amount)}
      </p>
      {isNegative && (
        <p className="mt-1 text-xs font-medium text-status-error">
          Negative balance
        </p>
      )}
    </div>
  );
}

function AccountCard({
  account,
  isOnline,
  onEdit,
}: {
  account: AccountRead;
  isOnline: boolean;
  onEdit: () => void;
}) {
  return (
    <article className="card-surface min-w-0 p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <AccountTypeBadge type={account.type} />
          <h3 className="mt-3 break-words text-lg font-semibold text-foreground">
            {account.name}
          </h3>
          <p className="mt-1 text-sm text-muted">
            {accountTypeLabels[account.type]}
          </p>
          {account.is_archived && (
            <span className="mt-3 inline-flex rounded-full bg-panel-raised px-3 py-1 text-xs font-medium text-muted">
              Archived
            </span>
          )}
        </div>
        <AccountActions account={account} isOnline={isOnline} onEdit={onEdit} />
      </div>
      <div className="mt-5 flex items-end justify-between gap-4 border-t border-outline pt-4">
        <p className="text-sm font-medium text-muted">Balance</p>
        <BalanceAmount amount={account.balance_minor} />
      </div>
    </article>
  );
}

function AccountsHeading({
  isOnline,
  onAdd,
}: {
  isOnline: boolean;
  onAdd: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Accounts
        </h1>
        <p className="mt-1 text-sm text-muted">Where your money lives.</p>
      </div>
      <Button
        className="hidden md:inline-flex"
        disabled={!isOnline}
        onClick={onAdd}
        startIcon={<Plus aria-hidden="true" size={18} />}
        sx={{ minHeight: 44, flexShrink: 0 }}
        title={!isOnline ? "You're offline. Changes need a connection." : undefined}
        variant="contained"
      >
        Add account
      </Button>
    </header>
  );
}

export function AccountsPage({
  homeTotalBalanceMinor,
  isHomeBalanceError,
  isHomeBalanceFetching,
  onRetryHomeBalance,
}: AccountsPageProps) {
  const isOnline = useConnectionStatus();
  const accountsQuery = useAccounts({ includeArchived: true });
  const activeSummary = useAccountsSummary();
  const allSummary = useAccountsSummary({ includeArchived: true });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRead | null>(null);

  const retryAccounts = () => {
    void Promise.all([
      accountsQuery.refetch(),
      activeSummary.refetch(),
      allSummary.refetch(),
    ]);
  };
  const accountQueriesHaveFatalError =
    (accountsQuery.isError && !accountsQuery.data) ||
    (activeSummary.isError && !activeSummary.data) ||
    (allSummary.isError && !allSummary.data);
  const isLoading =
    (!accountsQuery.data && accountsQuery.isPending) ||
    (!activeSummary.data && activeSummary.isPending) ||
    (!allSummary.data && allSummary.isPending);
  const accountRefreshFailed =
    accountsQuery.isError ||
    activeSummary.isError ||
    allSummary.isError;
  const accounts = accountsQuery.data ?? [];
  const activeAccounts = accounts.filter((account) => !account.is_archived);
  const archivedAccounts = accounts.filter((account) => account.is_archived);
  const canCompareHomeBalance =
    homeTotalBalanceMinor !== undefined &&
    !isHomeBalanceFetching &&
    !isHomeBalanceError &&
    !accountRefreshFailed &&
    !accountsQuery.isFetching &&
    !activeSummary.isFetching &&
    !allSummary.isFetching &&
    activeSummary.data !== undefined &&
    allSummary.data !== undefined;
  const activeMatchesHome =
    canCompareHomeBalance &&
    activeSummary.data?.totalBalanceMinor === homeTotalBalanceMinor;
  const allMatchesHome =
    canCompareHomeBalance &&
    allSummary.data?.totalBalanceMinor === homeTotalBalanceMinor;
  const includeArchivedInSummary = !activeMatchesHome && allMatchesHome;
  const summary = includeArchivedInSummary
    ? allSummary.data
    : activeSummary.data;
  const balanceDefinitionsDiffer =
    canCompareHomeBalance && !activeMatchesHome && !allMatchesHome;

  function addAccount() {
    if (!isOnline) return;
    setEditingAccount(null);
    setIsFormOpen(true);
  }

  function editAccount(account: AccountRead) {
    setEditingAccount(account);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingAccount(null);
  }

  return (
    <div className="space-y-6 pb-4">
      <AccountsHeading isOnline={isOnline} onAdd={addAccount} />

      {accountQueriesHaveFatalError ? (
        <ErrorState
          description="We couldn't load your accounts. Check your connection and try again."
          onRetry={retryAccounts}
          title="Accounts couldn't load"
        />
      ) : isLoading || !summary ? (
        <LoadingSkeleton label="Loading accounts" rows={4} />
      ) : (
        <>
          {accountRefreshFailed && (
            <Alert
              action={
                <Button color="inherit" onClick={retryAccounts}>
                  Try again
                </Button>
              }
              aria-live="polite"
              severity="warning"
            >
              Showing saved account data. We couldn&apos;t refresh it just now.
            </Alert>
          )}
          <section
            aria-label="Account summary"
            className="card-surface flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6"
          >
            <div>
              <p className="text-sm font-medium text-muted">Total balance</p>
              <div className="mt-2">
                <BalanceAmount amount={summary.totalBalanceMinor} />
              </div>
            </div>
            <p className="text-sm font-medium text-muted">
              {includeArchivedInSummary
                ? `${summary.accountCount} ${
                    summary.accountCount === 1 ? "account" : "accounts"
                  } including archived`
                : `${summary.accountCount} active ${
                    summary.accountCount === 1 ? "account" : "accounts"
                  }`}
            </p>
          </section>

          {balanceDefinitionsDiffer && (
            <Alert aria-live="polite" severity="warning">
              Backend issue: Home&apos;s total balance doesn&apos;t match the
              account total with archived accounts included or excluded. The
              dashboard and account balance definitions need to be reconciled.
            </Alert>
          )}
          {isHomeBalanceError && homeTotalBalanceMinor === undefined && (
            <Alert
              action={
                <Button color="inherit" onClick={onRetryHomeBalance}>
                  Retry Home
                </Button>
              }
              aria-live="polite"
              severity="warning"
            >
              We couldn&apos;t compare this total with Home because its balance
              didn&apos;t load.
            </Alert>
          )}
          {isHomeBalanceError && homeTotalBalanceMinor !== undefined && (
            <Alert aria-live="polite" severity="warning">
              Home&apos;s saved balance is being used for comparison; it
              couldn&apos;t be refreshed.
            </Alert>
          )}

          <section aria-labelledby="accounts-list-heading" className="space-y-4">
            <h2
              className="text-lg font-bold text-foreground"
              id="accounts-list-heading"
            >
              Your accounts
            </h2>
            {accounts.length === 0 ? (
              <EmptyState
                description="Add the places you keep money to see your balances in one place."
                title="No accounts yet"
              >
                <Button
                  className="mt-4"
                  disabled={!isOnline}
                  onClick={addAccount}
                  sx={{ minHeight: 44 }}
                  title={
                    !isOnline
                      ? "You're offline. Changes need a connection."
                      : undefined
                  }
                  variant="contained"
                >
                  Add account
                </Button>
              </EmptyState>
            ) : activeAccounts.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {activeAccounts.map((account) => (
                  <AccountCard
                    account={account}
                    isOnline={isOnline}
                    key={account.id}
                    onEdit={() => editAccount(account)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                description="Add an account to start tracking a new place where you keep money."
                title="No active accounts"
              >
                <Button
                  className="mt-4"
                  disabled={!isOnline}
                  onClick={addAccount}
                  sx={{ minHeight: 44 }}
                  variant="contained"
                >
                  Add account
                </Button>
              </EmptyState>
            )}
          </section>

          {archivedAccounts.length > 0 && (
            <details className="card-surface p-5">
              <summary className="min-h-11 cursor-pointer font-semibold text-foreground">
                Archived ({archivedAccounts.length})
              </summary>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {archivedAccounts.map((account) => (
                  <AccountCard
                    account={account}
                    isOnline={isOnline}
                    key={account.id}
                    onEdit={() => editAccount(account)}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}

      <Fab
        aria-label="Add account"
        className="fixed right-5 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-10 md:hidden"
        color="primary"
        disabled={!isOnline}
        onClick={addAccount}
        title={!isOnline ? "You're offline. Changes need a connection." : undefined}
      >
        <Plus aria-hidden="true" />
      </Fab>

      {isFormOpen && (
        <AccountFormDialog
          account={editingAccount}
          isOnline={isOnline}
          onClose={closeForm}
          open
        />
      )}
    </div>
  );
}
