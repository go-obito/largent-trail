"use client";

import {
  ArrowLeftRight,
  ChartColumn,
  House,
  Target,
  User,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./brand/Logo";

const navigationItems = [
  { href: "/", label: "Home", Icon: House },
  { href: "/transactions", label: "Transactions", Icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", Icon: Wallet },
  { href: "/needs", label: "Needs", Icon: Target, desktopOnly: true },
  { href: "/reports", label: "Reports", Icon: ChartColumn },
  { href: "/profile", label: "Profile", Icon: User },
];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <>
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
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-outline bg-panel px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
      >
        {navigationItems
          .filter((item) => !item.desktopOnly)
          .map(({ href, label, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 px-1 text-xs font-medium"
              href={href}
            >
              <span className={active ? "text-primary" : "text-muted"}>
                <Icon aria-hidden="true" size={20} strokeWidth={2} />
              </span>
              <span className={active ? "text-primary" : "text-muted"}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
