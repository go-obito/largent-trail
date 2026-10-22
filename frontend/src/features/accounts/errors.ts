import { ApiError } from "@/lib/api/client";

const messagesByCode: Record<string, string> = {
  duplicate_name: "You already have an account with that name.",
  account_in_use: "This account has transactions. Archive it instead.",
  id_conflict: "This account ID is already in use.",
  validation: "Check the account details and try again.",
  validation_error: "Check the account details and try again.",
};

const fallbackMessage = "We couldn't save this account. Please try again.";

export type AccountFieldErrors = Record<string, string>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function validationEntries(details: unknown): unknown[] {
  const record = asRecord(details);
  return record && Array.isArray(record.detail) ? record.detail : [];
}

export function accountFieldErrors(error: unknown): AccountFieldErrors {
  const details = error instanceof ApiError ? error.details : error;
  const fields: AccountFieldErrors = {};

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

export function accountErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code) {
    return messagesByCode[error.code] ?? fallbackMessage;
  }

  return fallbackMessage;
}
