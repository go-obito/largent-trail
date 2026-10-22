import {
  Baby,
  Banknote,
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Church,
  Clapperboard,
  Coffee,
  Droplet,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandHeart,
  HeartPulse,
  House,
  Landmark,
  Music,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Utensils,
  Users,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const categoryIcons = {
  utensils: Utensils,
  coffee: Coffee,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  bus: Bus,
  car: Car,
  fuel: Fuel,
  bike: Bike,
  smartphone: Smartphone,
  wifi: Wifi,
  zap: Zap,
  droplet: Droplet,
  house: House,
  "heart-pulse": HeartPulse,
  pill: Pill,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  clapperboard: Clapperboard,
  music: Music,
  "gamepad-2": Gamepad2,
  plane: Plane,
  gift: Gift,
  "hand-heart": HandHeart,
  users: Users,
  baby: Baby,
  "paw-print": PawPrint,
  shirt: Shirt,
  scissors: Scissors,
  wrench: Wrench,
  briefcase: Briefcase,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  landmark: Landmark,
  receipt: Receipt,
  church: Church,
} satisfies Record<string, LucideIcon>;

export type CategoryIconKey = keyof typeof categoryIcons;

const normalizedCategoryIcons: Record<string, LucideIcon> = {};
for (const [key, Icon] of Object.entries(categoryIcons)) {
  normalizedCategoryIcons[key.replaceAll(/[ _-]/g, "")] = Icon;
}

export function categoryIconForKey(key: string | null | undefined) {
  if (!key) {
    return undefined;
  }

  return normalizedCategoryIcons[key.trim().toLocaleLowerCase().replaceAll(/[ _-]/g, "")];
}
