import { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Target } from "lucide-react";
import Link from "next/link";

const actions = [
  {
    href: "/transactions/new?kind=expense",
    label: "Add expense",
    Icon: ArrowDownLeft,
    tone: "bg-status-error/10 text-status-error",
  },
  {
    href: "/transactions/new?kind=income",
    label: "Add income",
    Icon: ArrowUpRight,
    tone: "bg-status-success/10 text-status-success",
  },
  {
    href: "/needs",
    label: "Needs",
    Icon: Target,
    tone: "bg-status-warning/15 text-status-warning",
  },
  {
    href: "/reports",
    label: "More",
    Icon: MoreHorizontal,
    tone: "bg-panel-raised text-muted",
  },
];

export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-4 gap-2 sm:gap-3 md:hidden">
      {actions.map(({ href, label, Icon, tone }) => (
        <Link
          key={label}
          className="group flex min-h-[92px] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl px-1 py-2 text-center transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          href={href}
        >
          <span className={`flex size-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-[1.04] sm:size-14 ${tone}`}>
            <Icon aria-hidden="true" size={23} strokeWidth={1.9} />
          </span>
          <span className="text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
            {label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
