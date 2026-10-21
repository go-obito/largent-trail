"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { useCategories } from "@/features/categories/api";
import {
  useBudget,
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
} from "@/features/budgets/api";
import { budgetErrorMessage, budgetFieldErrors } from "@/features/budgets/errors";
import { ApiError } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { parseGhsInput } from "@/lib/money";
import { showToast } from "@/lib/toast";
import { uuidv7 } from "@/lib/uuid";

type BudgetRead = components["schemas"]["BudgetRead"];
type BudgetPeriod = BudgetRead["period"];

const budgetSchema = z.object({
  period: z.enum(["weekly", "monthly"]),
  category_id: z.string().min(1, "Choose an expense category."),
  limit: z.string().trim().min(1, "Enter a budget limit.").refine((value) => {
    const parsed = parseGhsInput(value);
    return parsed !== null && parsed > 0;
  }, "Enter an amount greater than zero, with up to two decimal places."),
  is_archived: z.boolean(),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

type BudgetFormProps = {
  mode: "create" | "edit";
  budgetId?: string;
};

function minorToInput(amountMinor: number) {
  const whole = Math.floor(amountMinor / 100).toString();
  const fraction = (amountMinor % 100).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function isMissingBudget(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export function BudgetForm({ mode, budgetId = "" }: BudgetFormProps) {
  const isEditing = mode === "edit";
  const budgetQuery = useBudget(isEditing ? budgetId : "");
  const budgetsQuery = useBudgets();
  const categoriesQuery = useCategories("expense");

  if (isEditing && budgetQuery.isPending && !budgetQuery.data) {
    return <LoadingSkeleton label="Loading budget" rows={3} />;
  }

  if (isEditing && budgetQuery.isError && !budgetQuery.data) {
    if (isMissingBudget(budgetQuery.error)) {
      return (
        <div className="space-y-4">
          <EmptyState
            description="This budget may have been deleted or you may not have access to it."
            title="Budget not found"
          />
          <Button component={Link} href="/budgets" variant="outlined">
            Back to budgets
          </Button>
        </div>
      );
    }
    return (
      <ErrorState
        description="We couldn't load this budget. Check your connection and try again."
        onRetry={() => void budgetQuery.refetch()}
      />
    );
  }

  if (isEditing && !budgetQuery.data) {
    return <LoadingSkeleton label="Preparing budget form" rows={3} />;
  }

  return (
    <BudgetFormEditor
      key={isEditing ? budgetQuery.data?.id : "new-budget"}
      budget={budgetQuery.data}
      budgetId={budgetId}
      budgets={budgetsQuery.data ?? []}
      budgetsError={!budgetsQuery.data && budgetsQuery.isError}
      budgetsLoading={!budgetsQuery.data && budgetsQuery.isPending}
      categories={categoriesQuery.data ?? []}
      categoriesError={!categoriesQuery.data && categoriesQuery.isError}
      categoriesLoading={!categoriesQuery.data && categoriesQuery.isPending}
      mode={mode}
      onRetry={() => {
        void Promise.all([budgetsQuery.refetch(), categoriesQuery.refetch()]);
      }}
    />
  );
}

function BudgetFormEditor({
  budget,
  budgetId = "",
  budgets,
  budgetsError,
  budgetsLoading,
  categories,
  categoriesError,
  categoriesLoading,
  mode,
  onRetry,
}: BudgetFormProps & {
  budget?: BudgetRead;
  budgets: BudgetRead[];
  budgetsError: boolean;
  budgetsLoading: boolean;
  categories: components["schemas"]["CategoryRead"][];
  categoriesError: boolean;
  categoriesLoading: boolean;
  onRetry: () => void;
}) {
  const router = useRouter();
  const isEditing = mode === "edit";
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();
  const [isOnline, setIsOnline] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [createId] = useState(() =>
    mode === "create" ? uuidv7() : "",
  );
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      period: budget?.period ?? "weekly",
      category_id: budget?.category_id ?? "",
      limit: budget ? minorToInput(budget.limit_minor) : "",
      is_archived: budget?.is_archived ?? false,
    },
  });
  const period = useWatch({ control: form.control, name: "period" });
  const selectedCategory = useWatch({
    control: form.control,
    name: "category_id",
  });
  const isPending =
    createBudget.isPending || updateBudget.isPending || deleteBudget.isPending;

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const existingCategories = useMemo(() => {
    const byPeriod = new Map<BudgetPeriod, Set<string>>([
      ["weekly", new Set()],
      ["monthly", new Set()],
    ]);
    for (const existing of budgets) {
      if (existing.id !== budget?.id) {
        byPeriod.get(existing.period)?.add(existing.category_id);
      }
    }
    return byPeriod;
  }, [budget?.id, budgets]);

  const categoryAlreadyBudgeted = (categoryId: string, forPeriod: BudgetPeriod) =>
    existingCategories.get(forPeriod)?.has(categoryId) ?? false;

  function changePeriod(nextPeriod: BudgetPeriod) {
    form.setValue("period", nextPeriod, { shouldValidate: true });
    if (
      selectedCategory &&
      categoryAlreadyBudgeted(selectedCategory, nextPeriod)
    ) {
      form.setValue("category_id", "", { shouldValidate: true });
    }
  }

  async function submit(values: BudgetFormValues) {
    setSubmitMessage("");
    const limitMinor = parseGhsInput(values.limit);
    if (limitMinor === null || limitMinor <= 0) {
      form.setError("limit", {
        type: "validate",
        message: "Enter an amount greater than zero, with up to two decimal places.",
      });
      return;
    }
    try {
      if (isEditing) {
        await updateBudget.mutateAsync({
          id: budgetId,
          changes: {
            limit_minor: limitMinor,
            is_archived: values.is_archived,
          },
        });
        showToast("Budget updated", "success");
      } else {
        await createBudget.mutateAsync({
          id: createId,
          category_id: values.category_id,
          period: values.period,
          limit_minor: limitMinor,
        });
        showToast("Budget created", "success");
      }
      router.replace("/budgets");
    } catch (error) {
      setSubmitMessage(budgetErrorMessage(error, values.period));
      for (const [field, message] of Object.entries(budgetFieldErrors(error))) {
        const formField = budgetFieldMap[field];
        if (formField) {
          form.setError(formField, { type: "server", message });
        }
      }
    }
  }

  async function confirmDelete() {
    try {
      await deleteBudget.mutateAsync(budgetId);
      showToast("Budget deleted", "success");
      router.replace("/budgets");
    } catch (error) {
      setSubmitMessage(budgetErrorMessage(error, budget?.period));
      setIsDeleteDialogOpen(false);
    }
  }

  const hasFormQueryError = !isEditing && (budgetsError || categoriesError);
  const isFormDataPending = !isEditing && (budgetsLoading || categoriesLoading);

  return (
    <section className="pb-28 md:pb-4">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Budgets
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {isEditing ? "Edit budget" : "Add budget"}
        </h1>
      </header>

      {submitMessage && (
        <Alert aria-live="polite" className="mb-4" severity="error">
          {submitMessage}
        </Alert>
      )}
      {!isOnline && (
        <Alert aria-live="polite" className="mb-4" severity="info">
          You&apos;re offline. Changes need a connection.
        </Alert>
      )}
      {isFormDataPending && (
        <div className="mb-5">
          <LoadingSkeleton label="Loading budget options" rows={2} />
        </div>
      )}
      {hasFormQueryError && (
        <Alert
          action={
            <Button color="inherit" onClick={onRetry} size="small">
              Try again
            </Button>
          }
          className="mb-4"
          severity="error"
        >
          Budget options could not be loaded.
        </Alert>
      )}
      {isEditing && (budgetsError || categoriesError) && (
        <Alert className="mb-4" severity="info">
          Showing saved details. Some budget options couldn&apos;t be refreshed.
        </Alert>
      )}
      {isEditing && budget && (
        <div className="mb-5 rounded-2xl border border-outline bg-panel p-4">
          <p className="font-semibold text-foreground">{budget.category_name}</p>
          <p className="mt-1 text-sm capitalize text-muted">{budget.period}</p>
        </div>
      )}

      <form className="space-y-5" noValidate onSubmit={form.handleSubmit(submit)}>
        {!isEditing && (
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-foreground">
                Period
              </legend>
              <div
                aria-label="Budget period"
                className="grid grid-cols-2 rounded-2xl bg-panel-raised p-1"
                role="group"
              >
                {(["weekly", "monthly"] as BudgetPeriod[]).map((value) => (
                  <button
                    key={value}
                    aria-pressed={period === value}
                    className={`min-h-11 rounded-xl px-4 font-semibold capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      period === value
                        ? "bg-primary text-on-primary"
                        : "text-muted hover:bg-panel"
                    }`}
                    onClick={() => changePeriod(value)}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>

            <FormControl
              disabled={categoriesLoading || categoriesError}
              error={Boolean(form.formState.errors.category_id)}
              fullWidth
            >
              <InputLabel id="budget-category-label">Expense category</InputLabel>
              <Controller
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <Select
                    {...field}
                    id="budget-category"
                    label="Expense category"
                    labelId="budget-category-label"
                    sx={{ minHeight: 44 }}
                  >
                    {categories.map((category) => {
                      const disabled = categoryAlreadyBudgeted(category.id, period);
                      return (
                        <MenuItem
                          key={category.id}
                          disabled={disabled}
                          value={category.id}
                        >
                          {category.name}
                          {disabled
                            ? ` (already has a ${period} budget)`
                            : ""}
                        </MenuItem>
                      );
                    })}
                  </Select>
                )}
              />
              <FormHelperText aria-live="polite">
                {form.formState.errors.category_id?.message}
              </FormHelperText>
            </FormControl>
          </>
        )}

        <TextField
          {...form.register("limit")}
          autoFocus={!isEditing}
          error={Boolean(form.formState.errors.limit)}
          fullWidth
          helperText={
            <span aria-live="polite">
              {form.formState.errors.limit?.message}
            </span>
          }
          label="Budget limit"
          placeholder="0.00"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">₵</InputAdornment>
              ),
            },
            htmlInput: { inputMode: "decimal" },
          }}
        />

        {isEditing && (
          <FormControlLabel
            control={
              <Controller
                control={form.control}
                name="is_archived"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    disabled={!isOnline || isPending}
                    onChange={field.onChange}
                  />
                )}
              />
            }
            label="Archive budget"
          />
        )}

        {isEditing && (
          <Button
            color="error"
            disabled={isPending || !isOnline}
            onClick={() => setIsDeleteDialogOpen(true)}
            sx={{ minHeight: 44 }}
            variant="outlined"
          >
            Delete budget
          </Button>
        )}

        <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 -mx-5 mt-6 bg-page/95 px-5 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:pb-0 md:backdrop-blur-none">
          <Button
            disabled={
              isPending ||
              !isOnline ||
              isFormDataPending ||
              hasFormQueryError
            }
            fullWidth
            sx={{ minHeight: 48 }}
            type="submit"
            variant="contained"
          >
            {isPending
              ? "Saving…"
              : isEditing
                ? "Save changes"
                : "Add budget"}
          </Button>
          {!isOnline && (
            <p aria-live="polite" className="mt-2 text-center text-sm text-muted">
              You&apos;re offline. Changes need a connection.
            </p>
          )}
        </div>
      </form>

      <Dialog
        onClose={() => setIsDeleteDialogOpen(false)}
        open={isDeleteDialogOpen}
      >
        <DialogTitle>Delete this budget?</DialogTitle>
        <DialogContent>
          <p className="text-sm text-muted">
            Your transactions are not affected.
          </p>
        </DialogContent>
        <DialogActions className="px-6 pb-5">
          <Button
            disabled={deleteBudget.isPending}
            onClick={() => setIsDeleteDialogOpen(false)}
            sx={{ minHeight: 44 }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            disabled={deleteBudget.isPending || !isOnline}
            onClick={() => void confirmDelete()}
            sx={{ minHeight: 44 }}
            variant="contained"
          >
            {deleteBudget.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}

const budgetFieldMap: Record<string, keyof BudgetFormValues> = {
  category_id: "category_id",
  limit_minor: "limit",
  period: "period",
};
