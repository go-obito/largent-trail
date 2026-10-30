import Button from "@mui/material/Button";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LogoDevAttribution, MerchantLogo } from "@/components/brand/MerchantLogo";
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
        <section className="card-surface h-full overflow-hidden p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Your money</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">Recent transactions</h2>
            </div>
            <Button
              component={Link}
              href="/transactions"
              endIcon={<ChevronRight aria-hidden="true" size={16} />}
              sx={{ minHeight: 44, flexShrink: 0, fontWeight: 600 }}
              variant="text"
            >
              See all
            </Button>
          </div>

          {transactions?.length ? (
            <>
              <ul className="mt-3 divide-y divide-outline">
              {transactions.map((transaction) => {
                const isIncome = transaction.kind === "income";
                const title = transaction.note?.trim() || transaction.category_name || "Uncategorized";
                const subtitle = transaction.note?.trim()
                  ? `${transaction.category_name || transaction.account_name} · ${transaction.account_name}`
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
                    className="flex items-center justify-between gap-3 py-3 first:pt-2 last:pb-1 sm:gap-4 sm:py-4"
                  >
                    <MerchantLogo categoryName={transaction.category_name || "Uncategorized"} merchantName={title} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                        {title}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted sm:text-sm">
                        {subtitle}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {transactionDate}
                      </p>
                    </div>
                    <p
                      className={`money shrink-0 text-right text-sm font-bold sm:text-base ${isIncome ? "text-status-success" : "text-status-error"}`}
                    >
                      {isIncome ? "+" : "−"}
                      {formatGhs(Math.abs(transaction.amount_minor))}
                    </p>
                  </li>
                );
              })}
              </ul>
              <LogoDevAttribution className="mt-3 text-right" />
            </>
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
