import { ApiError } from "@/lib/api/client";

const messagesByCode: Record<string, string> = {
  invalid_reference: "That account or category is no longer available.",
  archived_reference: "That account or category has been archived.",
  kind_mismatch: "That category belongs to a different type.",
  invalid_date: "Choose a valid date.",
  id_conflict: "This transaction ID is already in use.",
  duplicate_name: "An account with that name already exists.",
  rate_limited: "Too many requests. Please try again shortly.",
};

const fallbackMessage = "We couldn't save this transaction. Please try again.";

export type TransactionFieldErrors = Record<string, string>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function validationEntries(details: unknown): unknown[] {
  const record = asRecord(details);
  if (!record || !Array.isArray(record.detail)) {
    return [];
  }

  return record.detail;
}

export function transactionFieldErrors(error: unknown): TransactionFieldErrors {
  const details = error instanceof ApiError ? error.details : error;
  const fields: TransactionFieldErrors = {};

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

export function transactionErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code) {
    return messagesByCode[error.code] ?? fallbackMessage;
  }

  return fallbackMessage;
}
