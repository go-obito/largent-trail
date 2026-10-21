import Button from "@mui/material/Button";
import Link from "next/link";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";
import { formatDateInTimezone } from "@/lib/date";
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
        <section className="rounded-3xl border border-outline bg-panel p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold text-foreground">Recent activity</h2>
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
                return (
                  <li
                    key={transaction.id}
                    className="flex items-start justify-between gap-3 py-4 first:pt-2 last:pb-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {transaction.category_name || "Uncategorized"}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {transaction.account_name} ·{" "}
                        {formatDateInTimezone(
                          transaction.occurred_on,
                          timezone,
                        )}
                      </p>
                      {transaction.note && (
                        <p className="mt-1 break-words text-sm text-muted">
                          {transaction.note}
                        </p>
                      )}
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
