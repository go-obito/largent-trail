function localDateNoon(date: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  let instant = Date.UTC(year, month - 1, day, 12);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const values = Object.fromEntries(
      parts.map(({ type, value }) => [type, value]),
    );
    const actualLocalAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    instant += Date.UTC(year, month - 1, day, 12) - actualLocalAsUtc;
  }

  return new Date(instant);
}

export function dateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatDateInTimezone(
  date: string,
  timezone: string,
  weekday = false,
) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    ...(weekday ? { weekday: "long" as const } : {}),
    month: "short",
    day: "numeric",
    ...(weekday ? {} : { year: "numeric" as const }),
  }).format(localDateNoon(date, timezone));
}

export function weekdayInTimezone(date: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    weekday: "narrow",
  })
    .format(localDateNoon(date, timezone))
    .charAt(0);
}

export function addDaysToDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return [
    result.getUTCFullYear().toString().padStart(4, "0"),
    (result.getUTCMonth() + 1).toString().padStart(2, "0"),
    result.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

export function startOfWeekInTimezone(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDaysToDate(date, -((weekday + 6) % 7));
}

export function isCalendarDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}
