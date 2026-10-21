import {
  BriefcaseBusiness,
  Bus,
  CircleDollarSign,
  Clapperboard,
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
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";

const iconsByCategory: Record<string, LucideIcon> = {
  food: Utensils,
  transport: Bus,
  "airtime and data": Smartphone,
  utilities: Zap,
  rent: House,
  health: HeartPulse,
  education: GraduationCap,
  shopping: ShoppingBag,
  entertainment: Clapperboard,
  giving: HandHeart,
  "family support": Users,
  savings: PiggyBank,
  salary: BriefcaseBusiness,
  business: BriefcaseBusiness,
  gift: Gift,
  other: Shapes,
};

export function categoryIcon(name: string, iconKey: string | null): LucideIcon {
  const normalizedName = name.trim().toLocaleLowerCase();
  const normalizedKey = iconKey?.trim().toLocaleLowerCase();
  return (
    (normalizedKey ? iconsByCategory[normalizedKey] : undefined) ??
    iconsByCategory[normalizedName] ??
    CircleDollarSign
  );
}
