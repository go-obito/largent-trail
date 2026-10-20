"use client";

import IconButton from "@mui/material/IconButton";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type DashboardHeaderProps = {
  isRefreshing: boolean;
  name: string;
  onRefresh: () => void;
  timezone: string;
};

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

function localGreeting(timezone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(new Date()),
  );
  return greetingForHour(hour);
}

export function DashboardHeader({
  isRefreshing,
  name,
  onRefresh,
  timezone,
}: DashboardHeaderProps) {
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    const updateGreeting = () => {
      try {
        setGreeting(localGreeting(timezone));
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        setGreeting(localGreeting("Africa/Accra"));
      }
    };
    const timeout = window.setTimeout(updateGreeting, 0);
    const interval = window.setInterval(updateGreeting, 60_000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [timezone]);

  const initial = name.trim().charAt(0).toLocaleUpperCase() || "?";

  return (
    <header className="mb-8 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          WEEKLY MONEY OVERVIEW
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {greeting}, {name}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <IconButton
          aria-label={isRefreshing ? "Refreshing dashboard" : "Refresh dashboard"}
          disabled={isRefreshing}
          onClick={onRefresh}
          sx={{ minWidth: 44, minHeight: 44, color: "primary.main" }}
        >
          <RefreshCw
            aria-hidden="true"
            className={isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}
            size={20}
          />
        </IconButton>
        <span aria-live="polite" className="sr-only" role="status">
          {isRefreshing ? "Refreshing dashboard" : ""}
        </span>
        <div
          aria-label={`Profile: ${name}`}
          className="flex size-12 items-center justify-center rounded-full bg-brand text-lg font-semibold text-on-brand"
          role="img"
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
