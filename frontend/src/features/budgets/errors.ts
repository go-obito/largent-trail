import { ApiError } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type BudgetPeriod = components["schemas"]["BudgetPeriod"];

const messagesByCode: Record<string, string> = {
  kind_mismatch: "Budgets are for spending categories only.",
  invalid_reference: "That category is no longer available.",
  archived_reference: "That category has been archived.",
  rate_limited: "Too many requests. Please try again shortly.",
};

const fallbackMessage = "We couldn't save this budget. Please try again.";

export type BudgetFieldErrors = Record<string, string>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function validationEntries(details: unknown): unknown[] {
  const record = asRecord(details);
  return record && Array.isArray(record.detail) ? record.detail : [];
}

export function budgetFieldErrors(error: unknown): BudgetFieldErrors {
  const details = error instanceof ApiError ? error.details : error;
  const fields: BudgetFieldErrors = {};

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

export function budgetErrorMessage(
  error: unknown,
  period?: BudgetPeriod,
): string {
  if (error instanceof ApiError && error.code) {
    if (error.code === "duplicate_budget") {
      return period
        ? `You already have a ${period} budget for this category.`
        : "You already have a budget for this category for that period.";
    }

    return messagesByCode[error.code] ?? fallbackMessage;
  }

  return fallbackMessage;
}
