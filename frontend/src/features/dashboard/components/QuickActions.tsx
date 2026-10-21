import { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Target } from "lucide-react";
import Link from "next/link";

const actions = [
  { href: "/transactions/new?kind=expense", label: "Add expense", Icon: ArrowDownLeft },
  { href: "/transactions/new?kind=income", label: "Add income", Icon: ArrowUpRight },
  { href: "/needs", label: "Needs", Icon: Target },
  { href: "/reports", label: "More", Icon: MoreHorizontal },
];

export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-4 gap-2 md:hidden">
      {actions.map(({ href, label, Icon }) => (
        <Link
          key={label}
          className="card-surface flex min-h-[88px] flex-col items-center justify-center gap-2 px-1 text-center text-xs font-semibold text-foreground transition-colors hover:bg-panel-raised"
          href={href}
        >
          <Icon aria-hidden="true" className="text-brand" size={21} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
