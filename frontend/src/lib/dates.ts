function parseDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RangeError("Dates must use the YYYY-MM-DD format.");
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError("The date is not a valid calendar date.");
  }

  return parsed;
}

export function todayInTz(tz: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    calendar: "gregory",
    timeZone: tz,
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function weekStart(date: string): string {
  const start = parseDate(date);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);

  return start.toISOString().slice(0, 10);
}

export function formatDay(date: string): string {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseDate(date));
}
