import { ApiError } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type CategoryKind = components["schemas"]["CategoryKind"];

const messagesByCode: Record<string, string> = {
  category_in_use:
    "This category is used by transactions. Archive it instead to keep your history.",
  invalid_reference: "Choose a valid replacement category.",
  archived_reference: "The replacement category has been archived.",
  kind_mismatch: "Choose a replacement category of the same type.",
  validation: "Check the category details and try again.",
  validation_error: "Check the category details and try again.",
};

const fallbackMessage = "We couldn't save this category. Please try again.";

export type CategoryFieldErrors = Record<string, string>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function validationEntries(details: unknown): unknown[] {
  const record = asRecord(details);
  return record && Array.isArray(record.detail) ? record.detail : [];
}

export function categoryFieldErrors(error: unknown): CategoryFieldErrors {
  const details = error instanceof ApiError ? error.details : error;
  const fields: CategoryFieldErrors = {};

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

export function categoryErrorMessage(
  error: unknown,
  kind?: CategoryKind,
): string {
  if (error instanceof ApiError && error.code === "duplicate_name") {
    return `You already have a category with that name for ${kind ?? "this kind"}.`;
  }

  if (error instanceof ApiError && error.code) {
    return messagesByCode[error.code] ?? fallbackMessage;
  }

  return fallbackMessage;
}
