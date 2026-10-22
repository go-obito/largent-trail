"use client";

import { useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { useRef, useState } from "react";
import type { components } from "@/lib/api/schema";
import { useCreateBudget } from "@/features/budgets/api";
import { ApiError } from "@/lib/api/client";
import { parseGhsInput } from "@/lib/money";
import { uuidv7 } from "@/lib/uuid";
import { onboardingCopy } from "./copy";

type CategoryRead = components["schemas"]["CategoryRead"];
type BudgetRead = components["schemas"]["BudgetRead"];

export type OnboardingBudgetDraft = {
  enabled: boolean;
  amount: string;
};

type OnboardingBudgetStepProps = {
  categories: CategoryRead[];
  budgets: BudgetRead[];
  drafts: Record<string, OnboardingBudgetDraft>;
  isOnline: boolean;
  onDraftChange: (categoryId: string, draft: OnboardingBudgetDraft) => void;
  onBack: () => void;
  onContinue: () => void;
};

function suggestedCategories(categories: CategoryRead[]) {
  const suggestions = [
    (name: string) => name.includes("food"),
    (name: string) => name.includes("transport"),
    (name: string) => name.includes("airtime") || name.includes("data"),
  ];
  const selected = suggestions
    .map((matches) =>
      categories.find((category) => matches(category.name.toLowerCase())),
    )
    .filter((category): category is CategoryRead => Boolean(category));
  return Array.from(
    new Map(selected.map((category) => [category.id, category])).values(),
  );
}

function minorToInput(amountMinor: number) {
  const whole = Math.floor(amountMinor / 100).toString();
  const fraction = (amountMinor % 100).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function OnboardingBudgetStep({
  categories,
  budgets,
  drafts,
  isOnline,
  onDraftChange,
  onBack,
  onContinue,
}: OnboardingBudgetStepProps) {
  const createBudget = useCreateBudget();
  const queryClient = useQueryClient();
  const ids = useRef(new Map<string, string>());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const categoriesToShow = suggestedCategories(categories);
  const activeWeeklyBudgets = budgets.filter(
    (budget) => !budget.is_archived && budget.period === "weekly",
  );
  const existingByCategory = new Map(
    activeWeeklyBudgets.map((budget) => [budget.category_id, budget]),
  );
  const enabledCategories = categoriesToShow.filter(
    (category) =>
      drafts[category.id]?.enabled && !existingByCategory.has(category.id),
  );
  const hasValidAmount = categoriesToShow.some((category) => {
    const existing = existingByCategory.get(category.id);
    const value = existing
      ? minorToInput(existing.limit_minor)
      : drafts[category.id]?.amount ?? "";
    const amount = parseGhsInput(value);
    return amount !== null && amount > 0;
  });
  const isPending = createBudget.isPending;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (enabledCategories.length === 0) {
      onContinue();
      return;
    }
    if (!navigator.onLine) {
      setSubmitError(onboardingCopy.errors.saveBudgets);
      return;
    }

    const amounts = new Map<string, number>();
    const nextErrors: Record<string, string> = {};
    for (const category of enabledCategories) {
      const amount = parseGhsInput(drafts[category.id]?.amount ?? "");
      if (amount === null || amount <= 0) {
        nextErrors[category.id] = onboardingCopy.budget.invalid;
      } else {
        amounts.set(category.id, amount);
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    for (const category of enabledCategories) {
      const amount = amounts.get(category.id);
      if (amount === undefined) continue;

      const id = ids.current.get(category.id) ?? uuidv7();
      ids.current.set(category.id, id);
      try {
        await createBudget.mutateAsync({
          id,
          category_id: category.id,
          period: "weekly",
          limit_minor: amount,
        });
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 409 &&
          error.code === "duplicate_budget"
        ) {
          continue;
        }
        setSubmitError(onboardingCopy.errors.saveBudgets);
        return;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["budgets"] });
    onContinue();
  }

  return (
    <form className="mt-6 space-y-5" onSubmit={(event) => void submit(event)}>
      {submitError && (
        <Alert aria-live="polite" severity="error">
          {submitError}
        </Alert>
      )}
      {categoriesToShow.length > 0 ? (
        <ul className="divide-y divide-outline rounded-xl border border-outline">
          {categoriesToShow.map((category) => {
            const existing = existingByCategory.get(category.id);
            const draft = drafts[category.id] ?? { enabled: false, amount: "" };
            return (
              <li
                className="space-y-3 bg-panel px-4 py-4 first:rounded-t-xl last:rounded-b-xl"
                key={category.id}
              >
                <div className="flex items-center justify-between gap-4">
                  <FormControlLabel
                    control={
                      <Switch
                        slotProps={{
                          input: {
                            "aria-label": onboardingCopy.budget.toggleLabel(
                              category.name,
                            ),
                          },
                        }}
                        checked={Boolean(existing) || draft.enabled}
                        disabled={Boolean(existing) || isPending}
                        onChange={(event) => {
                          onDraftChange(category.id, {
                            ...draft,
                            enabled: event.target.checked,
                          });
                          setErrors((current) => ({
                            ...current,
                            [category.id]: "",
                          }));
                        }}
                      />
                    }
                    label={category.name}
                  />
                  {existing && (
                    <span className="text-sm text-muted">
                      {onboardingCopy.budget.alreadySet}
                    </span>
                  )}
                </div>
                <TextField
                  disabled={Boolean(existing) || !draft.enabled || isPending}
                  error={Boolean(errors[category.id])}
                  fullWidth
                  helperText={errors[category.id]}
                  label={onboardingCopy.budget.amountLabel(category.name)}
                  onChange={(event) => {
                    onDraftChange(category.id, {
                      ...draft,
                      amount: event.target.value,
                    });
                    setErrors((current) => ({
                      ...current,
                      [category.id]: "",
                    }));
                  }}
                  slotProps={{
                    htmlInput: { inputMode: "decimal" },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">₵</InputAdornment>
                      ),
                    },
                  }}
                  value={
                    existing
                      ? minorToInput(existing.limit_minor)
                      : draft.amount
                  }
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">{onboardingCopy.budget.noSuggestions}</p>
      )}

      {hasValidAmount && (
        <p className="text-sm text-muted" role="status">
          {onboardingCopy.budget.example}
        </p>
      )}
      {!isOnline && enabledCategories.length > 0 && (
        <p className="text-sm text-muted" role="status">
          {onboardingCopy.accounts.offlineAdd}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          className="min-h-11"
          disabled={isPending}
          onClick={onBack}
          type="button"
          variant="outlined"
        >
          {onboardingCopy.navigation.back}
        </Button>
        <Button
          className="min-h-11"
          disabled={isPending || (enabledCategories.length > 0 && !isOnline)}
          type="submit"
          variant="contained"
        >
          {isPending
            ? onboardingCopy.budget.saving
            : enabledCategories.length > 0
              ? onboardingCopy.budget.save
              : onboardingCopy.budget.next}
        </Button>
      </div>
    </form>
  );
}
