import type { components } from "@/lib/api/schema";

type NeedPriority = components["schemas"]["NeedPriority"];
type NeedRead = components["schemas"]["NeedRead"];

const priorityLabels: Record<NeedPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const priorityClasses: Record<NeedPriority, string> = {
  high: "bg-[color-mix(in_srgb,var(--color-error)_14%,var(--color-surface))] text-status-error",
  medium:
    "bg-[color-mix(in_srgb,var(--color-warning)_14%,var(--color-surface))] text-status-warning",
  low: "bg-[color-mix(in_srgb,var(--color-info)_14%,var(--color-surface))] text-status-info",
};

const priorityRank: Record<NeedPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function priorityLabel(priority: NeedPriority): string {
  return priorityLabels[priority];
}

export function priorityColor(priority: NeedPriority): string {
  return priorityClasses[priority];
}

export function sortByPriority(needs: NeedRead[]): string[] {
  return needs
    .map((need, index) => ({ id: need.id, priority: need.priority, index }))
    .sort(
      (a, b) =>
        priorityRank[a.priority] - priorityRank[b.priority] ||
        a.index - b.index,
    )
    .map(({ id }) => id);
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function domainOf(value: string): string {
  if (!isSafeHttpUrl(value)) {
    return "";
  }

  return new URL(value).hostname.replace(/^www\./i, "");
}

export function formatForeignMinor(minor: number, currency: string): string {
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError("Foreign currency amounts must be safe integers.");
  }
  if (!/^[A-Za-z]{3}$/.test(currency)) {
    throw new RangeError("Currency must be a three-letter code.");
  }

  const amount = BigInt(minor);
  const hundred = BigInt(100);
  const absolute = amount < 0 ? -amount : amount;
  const whole = (absolute / hundred)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (absolute % hundred).toString().padStart(2, "0");
  const sign = amount < 0 ? "-" : "";

  return `${currency.toUpperCase()} ${sign}${whole}.${fraction}`;
}
