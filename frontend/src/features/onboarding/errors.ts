import { ApiError } from "@/lib/api/client";
import { onboardingCopy } from "./copy";

const validationMessages: Record<string, string> = {
  display_name: onboardingCopy.validation.displayName,
  timezone: onboardingCopy.validation.timezone,
  name: onboardingCopy.validation.name,
  type: onboardingCopy.validation.type,
  opening_balance_minor: onboardingCopy.validation.openingBalance,
};

export function onboardingFieldErrors(error: unknown): Record<string, string> {
  const details = error instanceof ApiError ? error.details : null;
  if (
    typeof details !== "object" ||
    details === null ||
    !("detail" in details) ||
    !Array.isArray(details.detail)
  ) {
    return {};
  }

  const fields: Record<string, string> = {};
  for (const entry of details.detail) {
    if (typeof entry !== "object" || entry === null || !("loc" in entry)) {
      continue;
    }

    const location = entry.loc;
    if (!Array.isArray(location)) continue;
    const field = [...location].reverse().find(
      (part): part is string => typeof part === "string" && part !== "body",
    );
    if (field && validationMessages[field]) {
      fields[field] = validationMessages[field];
    }
  }

  return fields;
}
