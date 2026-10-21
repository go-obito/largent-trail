"use client";

import LinearProgress from "@mui/material/LinearProgress";
import type { components } from "@/lib/api/schema";
import { formatGhs } from "@/lib/money";
import {
  dateInTimezone,
  formatDateInTimezone,
  weekdayInTimezone,
} from "@/lib/date";
import { DashboardSection } from "./DashboardSection";

type DashboardRead = components["schemas"]["DashboardRead"];

type WeeklyProgressCardProps = {
  data?: DashboardRead;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  timezone: string;
};

export function WeeklyProgressCard({
  data,
  isError,
  isLoading,
  onRetry,
  timezone,
}: WeeklyProgressCardProps) {
  const days = data?.daily_breakdown ?? [];
  const maxSpent = Math.max(0, ...days.map((day) => day.spent_minor));
  const today = dateInTimezone(new Date(), timezone);
  const weeklyTarget = data?.week.budget_total_minor;
  const progress =
    weeklyTarget && weeklyTarget > 0
      ? Math.min(100, (data?.week.spent_minor ?? 0) / weeklyTarget * 100)
      : 0;

  return (
    <DashboardSection
      isError={isError}
      isLoading={isLoading}
      label="weekly progress"
      onRetry={onRetry}
    >
      {data && (
        <section className="card-surface p-5">
          <h2 className="text-lg font-bold text-foreground">Weekly breakdown</h2>
          <LinearProgress
            aria-label="Weekly budget progress"
            sx={{ mt: 4, height: 8, borderRadius: 99 }}
            value={progress}
            variant="determinate"
          />
          {weeklyTarget != null && (
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">
                {formatGhs(data.week.spent_minor)} of {formatGhs(weeklyTarget)}
              </span>
              {data.week.budget_left_minor !== null && (
                <span
                  className={`font-semibold ${
                    data.week.budget_left_minor < 0
                      ? "text-status-error"
                      : "text-muted"
                  }`}
                >
                  {data.week.budget_left_minor < 0
                    ? `${formatGhs(Math.abs(data.week.budget_left_minor))} over`
                    : `${formatGhs(data.week.budget_left_minor)} left`}
                </span>
              )}
            </div>
          )}

          <div className="mt-7 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">Spending by day</h3>
            <span className="text-sm text-muted">This week</span>
          </div>
          {days.length > 0 ? (
            <>
              <div
                aria-label="Daily spending this week"
                className="mt-4 grid grid-cols-7 gap-2"
                role="list"
              >
                {days.map((day) => {
                  const isToday = day.date === today;
                  const height =
                    maxSpent === 0
                      ? 6
                      : day.spent_minor === 0
                        ? 6
                        : Math.max(12, (day.spent_minor / maxSpent) * 72);
                  const weekday = weekdayInTimezone(day.date, timezone);
                  const fullDate = formatDateInTimezone(
                    day.date,
                    timezone,
                    true,
                  );

                  return (
                    <div
                      key={day.date}
                      aria-label={`${fullDate}, ${formatGhs(day.spent_minor)}`}
                      className="flex min-w-0 flex-col items-center gap-2"
                      role="listitem"
                    >
                      <div className="flex h-[76px] items-end">
                        <span
                          aria-hidden="true"
                          className={`w-5 rounded-t-md ${
                            isToday
                              ? "bg-brand"
                              : day.spent_minor === 0
                                ? "bg-panel-raised"
                                : "bg-selected"
                          }`}
                          style={{ height: `${height}px` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          isToday ? "text-brand" : "text-muted"
                        }`}
                      >
                        {weekday}
                      </span>
                    </div>
                  );
                })}
              </div>
              <table className="sr-only">
                <caption>Daily spending this week</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Date</th>
                    <th scope="col">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.date}>
                      <th scope="row">
                        {formatDateInTimezone(day.date, timezone, true)}
                      </th>
                      <td>{day.date}</td>
                      <td>{formatGhs(day.spent_minor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">No daily spending yet.</p>
          )}
        </section>
      )}
    </DashboardSection>
  );
}
