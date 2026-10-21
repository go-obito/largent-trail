import type { CSSProperties } from "react";
import {
  Banknote,
  Briefcase,
  Bus,
  Clapperboard,
  Ellipsis,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  PiggyBank,
  Shapes,
  ShoppingBag,
  Smartphone,
  Users,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { chartColors } from "@/styles/palette";

type BadgeSize = 36 | 44 | 48;

const defaultCategories: Record<string, { color: number; Icon: LucideIcon }> = {
  food: { color: 1, Icon: UtensilsCrossed },
  transport: { color: 5, Icon: Bus },
  "airtime and data": { color: 0, Icon: Smartphone },
  utilities: { color: 1, Icon: Zap },
  rent: { color: 7, Icon: House },
  health: { color: 3, Icon: HeartPulse },
  education: { color: 0, Icon: GraduationCap },
  shopping: { color: 2, Icon: ShoppingBag },
  entertainment: { color: 4, Icon: Clapperboard },
  giving: { color: 6, Icon: HandHeart },
  "family support": { color: 5, Icon: Users },
  savings: { color: 4, Icon: PiggyBank },
  salary: { color: 4, Icon: Banknote },
  business: { color: 0, Icon: Briefcase },
  gift: { color: 6, Icon: Gift },
  other: { color: 7, Icon: Ellipsis },
};

const iconAliases: Record<string, LucideIcon> = {
  banknote: Banknote,
  briefcase: Briefcase,
  bus: Bus,
  clapperboard: Clapperboard,
  ellipsis: Ellipsis,
  gift: Gift,
  graduationcap: GraduationCap,
  handheart: HandHeart,
  heartpulse: HeartPulse,
  house: House,
  piggybank: PiggyBank,
  shoppingbag: ShoppingBag,
  smartphone: Smartphone,
  users: Users,
  utensilscrossed: UtensilsCrossed,
  zap: Zap,
};

function normalizeName(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function normalizeIcon(value: string | null | undefined) {
  return normalizeName(value).replaceAll(/[ _-]/g, "");
}

function colorIndex(name: string) {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % chartColors.length;
}

export function categoryPresentation(name: string, icon?: string | null) {
  const normalizedName = normalizeName(name);
  const fallback = defaultCategories[normalizedName];
  const Icon = iconAliases[normalizeIcon(icon)] ?? fallback?.Icon ?? Shapes;
  return {
    Icon,
    color: chartColors[fallback?.color ?? colorIndex(normalizedName)],
  };
}

export function CategoryBadge({
  name,
  icon,
  size = 44,
}: {
  name: string;
  icon?: string | null;
  size?: BadgeSize;
}) {
  const { color, Icon } = categoryPresentation(name, icon);
  const style = {
    "--category-color": color,
    "--category-tint": `color-mix(in srgb, ${color} 14%, var(--color-surface))`,
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--category-tint)] text-[var(--category-color)]"
      style={{ ...style, height: size, width: size }}
    >
      <Icon size={size === 36 ? 18 : size === 44 ? 20 : 22} strokeWidth={1.9} />
    </span>
  );
}
