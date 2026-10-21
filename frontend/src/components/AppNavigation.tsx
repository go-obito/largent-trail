"use client";

import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import {
  ArrowLeftRight,
  Bell,
  ChartColumn,
  ChevronDown,
  House,
  Target,
  User,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/features/dashboard/api";
import { budgetAlertMessage } from "@/features/budgets/alerts";
import { budgetsNeedingAttention } from "@/features/budgets/helpers";
import { clearPersistedQueryCache } from "@/app/providers";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Logo } from "./brand/Logo";

const navigationItems = [
  { href: "/", label: "Home", Icon: House },
  { href: "/transactions", label: "Transactions", Icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", Icon: Wallet },
  { href: "/needs", label: "Needs", Icon: Target, mobileHidden: true },
  { href: "/reports", label: "Reports", Icon: ChartColumn },
  { href: "/profile", label: "Profile", Icon: User },
];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

function NotificationBell() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const dashboard = useDashboard("this_month");
  const alerts = budgetsNeedingAttention(dashboard.data?.budgets ?? []);

  return (
    <>
      <IconButton
        aria-label={
          alerts.length
            ? `Notifications, ${alerts.length} budget alerts`
            : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ color: "text.primary", position: "relative" }}
      >
        <Bell aria-hidden="true" size={20} />
        {alerts.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-panel bg-status-error"
          />
        )}
      </IconButton>
      <Menu
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        open={Boolean(anchor)}
        slotProps={{ paper: { sx: { width: 320, maxWidth: "calc(100vw - 32px)" } } }}
      >
        <div aria-label="Budget alerts" className="px-4 py-2" role="dialog">
          <h2 className="mb-2 text-sm font-bold text-foreground">Notifications</h2>
          {dashboard.isPending && !dashboard.data ? (
            <p className="py-3 text-sm text-muted">Loading budget alerts…</p>
          ) : dashboard.isError && !dashboard.data ? (
            <div className="py-2">
              <p className="text-sm text-muted">Budget alerts could not be loaded.</p>
              <button
                className="mt-2 text-sm font-semibold text-brand"
                onClick={() => void dashboard.refetch()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : alerts.length ? (
            <ul className="divide-y divide-outline">
              {alerts.map((budget) => (
                <li key={budget.id}>
                  <Link
                    className="block py-3 text-sm text-foreground hover:text-brand"
                    href="/budgets"
                    onClick={() => setAnchor(null)}
                  >
                    <span className="font-semibold">
                      {budgetAlertMessage(budget)}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {budget.category_name} ·{" "}
                      {budget.period === "weekly" ? "Weekly" : "Monthly"} budget
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted">You&apos;re all caught up</p>
          )}
        </div>
      </Menu>
    </>
  );
}

function UserMenu() {
  const { user } = useUser();
  const { userId } = useAuth();
  const clerk = useClerk();
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const name = user?.firstName?.trim() || user?.fullName?.trim() || "Account";
  const initial = name.charAt(0).toLocaleUpperCase();

  const signOut = async () => {
    if (!userId || isSigningOut) return;
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await clearPersistedQueryCache(userId);
      queryClient.clear();
      await clerk.signOut({ redirectUrl: "/sign-in" });
    } catch {
      setSignOutError("We couldn’t sign you out. Please try again.");
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <button
        aria-expanded={Boolean(anchor)}
        aria-haspopup="menu"
        className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-foreground hover:bg-selected"
        onClick={(event) => setAnchor(event.currentTarget)}
        type="button"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-brand text-sm text-on-brand">
          {initial}
        </span>
        <span className="max-w-32 truncate">{name}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      <Menu
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        open={Boolean(anchor)}
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        <MenuItem
          component={Link}
          href="/profile"
          onClick={() => setAnchor(null)}
        >
          Profile
        </MenuItem>
        <div className="px-4 pb-3 pt-2">
          <p className="mb-2 text-xs font-semibold text-muted">Theme</p>
          <ThemeSwitcher />
        </div>
        {signOutError && (
          <p className="px-4 pb-2 text-xs text-status-error" role="alert">
            {signOutError}
          </p>
        )}
        <MenuItem
          disabled={isSigningOut}
          onClick={() => void signOut()}
        >
          {isSigningOut ? "Signing out…" : "Sign out"}
        </MenuItem>
      </Menu>
    </>
  );
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-outline bg-panel px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <Link aria-label="Largent home" href="/">
          <Logo />
        </Link>
        <NotificationBell />
      </header>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-20 border-r border-outline bg-panel md:flex md:flex-col md:py-8 lg:w-60">
        <Link
          aria-label="Largent home"
          className="mb-10 flex justify-center px-4 lg:justify-start"
          href="/"
        >
          <Logo className="hidden lg:inline-flex" />
          <Logo markClassName="size-10 text-primary lg:hidden" variant="mark" />
        </Link>
        <nav aria-label="Main navigation" className="flex flex-col gap-2 px-2 lg:px-3">
          {navigationItems.map(({ href, label, Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={`flex min-h-12 items-center justify-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:justify-start lg:gap-3 lg:px-3 ${
                  active
                    ? "bg-selected text-primary"
                    : "text-muted hover:bg-selected hover:text-foreground"
                }`}
                href={href}
                title={label}
              >
                <Icon aria-hidden="true" size={21} strokeWidth={2} />
                <span className="hidden text-sm font-semibold lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <header className="fixed left-20 right-0 top-0 z-30 hidden h-[72px] items-center justify-end gap-3 border-b border-outline bg-panel px-8 lg:left-60 lg:flex">
        <div aria-hidden="true" className="hidden flex-1" />
        <NotificationBell />
        <UserMenu />
      </header>
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-outline bg-panel px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
      >
        {navigationItems
          .filter((item) => !item.mobileHidden)
          .map(({ href, label, Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 px-1 text-xs font-medium ${
                  active ? "text-primary" : "text-muted"
                }`}
                href={href}
              >
                <Icon aria-hidden="true" size={20} strokeWidth={2} />
                <span>{label}</span>
              </Link>
            );
          })}
      </nav>
    </>
  );
}
