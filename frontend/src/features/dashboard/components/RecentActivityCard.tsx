import Button from "@mui/material/Button";
import Link from "next/link";
import { CategoryBadge } from "@/components/CategoryBadge";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";
import { addDaysToDate, formatDateInTimezone } from "@/lib/date";
import { todayInTz } from "@/lib/dates";
import { DashboardSection } from "./DashboardSection";

type DashboardRead = components["schemas"]["DashboardRead"];

type RecentActivityCardProps = {
  data?: DashboardRead;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  timezone: string;
};

export function RecentActivityCard({
  data,
  isError,
  isLoading,
  onRetry,
  timezone,
}: RecentActivityCardProps) {
  const transactions = data?.recent_transactions.slice(0, 5);

  return (
    <DashboardSection
      isError={isError}
      isLoading={isLoading}
      label="recent activity"
      onRetry={onRetry}
    >
      {data && (
        <section className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-foreground">Recent transactions</h2>
            <Button
              component={Link}
              href="/transactions"
              sx={{ minHeight: 44 }}
              variant="text"
            >
              See all
            </Button>
          </div>

          {transactions?.length ? (
            <ul className="mt-4 divide-y divide-outline">
              {transactions.map((transaction) => {
                const isIncome = transaction.kind === "income";
                const title = transaction.note?.trim() || transaction.category_name || "Uncategorized";
                const subtitle = transaction.note?.trim()
                  ? transaction.category_name || transaction.account_name
                  : transaction.account_name;
                const today = todayInTz(timezone);
                const transactionDate =
                  transaction.occurred_on === today
                    ? "Today"
                    : transaction.occurred_on === addDaysToDate(today, -1)
                      ? "Yesterday"
                      : formatDateInTimezone(transaction.occurred_on, timezone)
                          .replace(/, \d{4}$/, "");
                return (
                  <li
                    key={transaction.id}
                    className="flex items-start justify-between gap-3 py-4 first:pt-2 last:pb-1"
                  >
                    <CategoryBadge name={transaction.category_name || "Uncategorized"} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">
                        {title}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {subtitle}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {transactionDate}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-right font-semibold ${
                        isIncome ? "text-status-success" : "text-status-error"
                      }`}
                    >
                      {isIncome ? "+" : "−"}
                      {formatGhs(Math.abs(transaction.amount_minor))}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl bg-panel-raised p-4 text-center font-medium text-muted">
              No transactions yet
            </p>
          )}
        </section>
      )}
    </DashboardSection>
  );
}
