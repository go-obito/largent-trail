import type { CSSProperties } from "react";
import { Banknote, Landmark, Smartphone, Wallet, type LucideIcon } from "lucide-react";
import type { components } from "@/lib/api/schema";
import { chartColors } from "@/styles/palette";

type AccountType = components["schemas"]["AccountType"];

const accountTypes: Record<
  AccountType,
  { label: string; color: number; Icon: LucideIcon }
> = {
  cash: { label: "Cash", color: 0, Icon: Banknote },
  bank: { label: "Bank", color: 2, Icon: Landmark },
  mobile_money: { label: "Mobile money", color: 4, Icon: Smartphone },
  other: { label: "Other", color: 7, Icon: Wallet },
};

export function AccountTypeBadge({ type }: { type: AccountType }) {
  const { label, color: colorIndex, Icon } = accountTypes[type];
  const color = chartColors[colorIndex];
  const style = {
    "--account-type-color": color,
    "--account-type-tint": `color-mix(in srgb, ${color} 14%, var(--color-surface))`,
  } as CSSProperties;

  return (
    <span
      className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[var(--account-type-tint)] px-3 text-sm font-medium text-[var(--account-type-color)]"
      style={style}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.9} />
      {label}
    </span>
  );
}
