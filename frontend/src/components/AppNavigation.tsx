"use client";

import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  House,
  PiggyBank,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/", label: "Home", Icon: House },
  { href: "/transactions", label: "Transactions", Icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", Icon: PiggyBank },
  { href: "/reports", label: "Reports", Icon: ChartNoAxesCombined },
  { href: "/profile", label: "Profile", Icon: UserRound },
];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-20 border-r border-outline bg-panel md:flex md:flex-col md:items-center md:py-8">
        <Link
          aria-label="Largent home"
          className="mb-10 flex size-12 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-on-brand"
          href="/"
        >
          L
        </Link>
        <nav aria-label="Main navigation" className="flex flex-col gap-3">
          {navigationItems.map(({ href, label, Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={`flex size-12 items-center justify-center rounded-2xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  active
                    ? "bg-brand text-on-brand"
                    : "text-muted hover:bg-selected hover:text-foreground"
                }`}
                href={href}
                title={label}
              >
                <Icon aria-hidden="true" size={21} strokeWidth={2} />
              </Link>
            );
          })}
        </nav>
      </aside>
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-outline bg-panel px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
      >
        {navigationItems.map(({ href, label, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              aria-current={active ? "page" : undefined}
              className="flex min-h-12 min-w-14 flex-col items-center justify-center gap-1 px-1 text-xs font-medium"
              href={href}
            >
              <span
                className={`flex size-9 items-center justify-center rounded-full ${
                  active ? "bg-brand text-on-brand" : "text-muted"
                }`}
              >
                <Icon aria-hidden="true" size={20} strokeWidth={2} />
              </span>
              <span className={active ? "text-foreground" : "text-muted"}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
