import { ApiError } from "@/lib/api/client";

const messagesByCode: Record<string, string> = {
  insufficient_unallocated: "You don't have enough unallocated savings.",
  exceeds_target: "That's more than this need still requires.",
  exceeds_allocated: "You can't take back more than is set aside.",
  invalid_order: "The list changed. We've refreshed it.",
  limit_reached: "You've reached the limit of 200 needs.",
  id_conflict: "This need ID is already in use.",
  invalid_url: "Enter a valid link.",
  url_not_allowed: "That link can't be used.",
  fetch_timeout: "The link took too long to check. Try again.",
  rate_limited: "Too many link lookups. Try again in a minute.",
};

const fallbackMessage = "We couldn't save this need. Please try again.";

export type NeedFieldErrors = Record<string, string>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function validationEntries(details: unknown): unknown[] {
  const record = asRecord(details);
  return record && Array.isArray(record.detail) ? record.detail : [];
}

export function needFieldErrors(error: unknown): NeedFieldErrors {
  const details = error instanceof ApiError ? error.details : error;
  const fields: NeedFieldErrors = {};

  for (const entry of validationEntries(details)) {
    const validation = asRecord(entry);
    const location = validation?.loc;
    const message = validation?.msg;
    if (!Array.isArray(location) || typeof message !== "string") {
      continue;
    }

    const field = [...location]
      .reverse()
      .find((part): part is string => typeof part === "string" && part !== "body");
    if (field) {
      fields[field] = message;
    }
  }

  return fields;
}

export function needErrorMessage(error: unknown): string | null {
  if (error instanceof ApiError && error.code === "allocation_outstanding") {
    return null;
  }
  if (error instanceof ApiError && error.code) {
    return messagesByCode[error.code] ?? fallbackMessage;
  }

  return fallbackMessage;
}
