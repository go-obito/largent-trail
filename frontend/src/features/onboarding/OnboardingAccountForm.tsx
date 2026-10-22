"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/states/EmptyState";
import { useCreateAccount } from "@/features/accounts/api";
import { ApiError } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { formatGhs, parseGhsInput } from "@/lib/money";
import { uuidv7 } from "@/lib/uuid";
import { onboardingFieldErrors } from "./errors";
import { onboardingCopy } from "./copy";

type AccountRead = components["schemas"]["AccountRead"];
const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, onboardingCopy.accounts.nameRequired)
    .max(100, onboardingCopy.accounts.nameTooLong),
  type: z.enum(["cash", "bank", "mobile_money", "other"]),
  openingBalance: z
    .string()
    .trim()
    .refine((value) => parseGhsInput(value) !== null, {
      message: onboardingCopy.accounts.balanceInvalid,
    }),
});

type AccountFormValues = z.infer<typeof accountSchema>;

type OnboardingAccountFormProps = {
  accounts: AccountRead[];
  isOnline: boolean;
  onBack: () => void;
  onContinue: () => void;
};

export function OnboardingAccountForm({
  accounts,
  isOnline,
  onBack,
  onContinue,
}: OnboardingAccountFormProps) {
  const createAccount = useCreateAccount();
  const [accountId, setAccountId] = useState(() => uuidv7());
  const [submitError, setSubmitError] = useState("");
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setError,
    setValue,
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: "cash",
      openingBalance: "0.00",
    },
  });

  async function submit(values: AccountFormValues) {
    setSubmitError("");
    if (!navigator.onLine) {
      setSubmitError(onboardingCopy.accounts.offlineAdd);
      return;
    }
    const openingBalance = parseGhsInput(values.openingBalance);
    if (openingBalance === null) {
      setError("openingBalance", {
        type: "validate",
        message: onboardingCopy.accounts.balanceInvalid,
      });
      return;
    }

    try {
      await createAccount.mutateAsync({
        id: accountId,
        name: values.name.trim(),
        type: values.type,
        opening_balance_minor: openingBalance,
      });
      setAccountId(uuidv7());
      reset({ name: "", type: "cash", openingBalance: "0.00" });
    } catch (error) {
      const serverErrors = onboardingFieldErrors(error);
      if (serverErrors.name) {
        setError("name", { type: "server", message: serverErrors.name });
      }
      if (serverErrors.type) {
        setError("type", { type: "server", message: serverErrors.type });
      }
      if (serverErrors.opening_balance_minor) {
        setError("openingBalance", {
          type: "server",
          message: serverErrors.opening_balance_minor,
        });
      }
      if (error instanceof ApiError && error.code === "duplicate_name") {
        setError("name", {
          type: "server",
          message: onboardingCopy.accounts.nameExists,
        });
        setSubmitError(onboardingCopy.accounts.duplicateName);
      } else {
        setSubmitError(onboardingCopy.accounts.addError);
      }
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <form className="space-y-5" onSubmit={handleSubmit(submit)}>
        {submitError && (
          <Alert aria-live="polite" severity="error">
            {submitError}
          </Alert>
        )}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {onboardingCopy.accounts.quickAdd}
          </p>
          <div
            aria-label={onboardingCopy.accounts.quickPicksLabel}
            className="flex flex-wrap gap-2"
          >
            {onboardingCopy.accounts.quickPicks.map((pick) => (
              <Chip
                clickable
                key={pick.name}
                label={pick.name}
                onClick={() => {
                  setValue("name", pick.name, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setValue("type", pick.type, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setSubmitError("");
                }}
                variant="outlined"
              />
            ))}
          </div>
        </div>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField
              {...field}
              autoComplete="off"
              error={Boolean(errors.name)}
              fullWidth
              helperText={errors.name?.message}
              label={onboardingCopy.accounts.nameLabel}
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
          )}
        />
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <FormControl error={Boolean(errors.type)} fullWidth>
              <InputLabel id="onboarding-account-type-label">
                {onboardingCopy.accounts.typeLabel}
              </InputLabel>
              <Select
                {...field}
                id="onboarding-account-type"
                label={onboardingCopy.accounts.typeLabel}
                labelId="onboarding-account-type-label"
              >
                {onboardingCopy.accounts.types.map(({ label, value }) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
              {errors.type?.message && (
                <FormHelperText>{errors.type.message}</FormHelperText>
              )}
            </FormControl>
          )}
        />
        <Controller
          control={control}
          name="openingBalance"
          render={({ field }) => (
            <TextField
              {...field}
              error={Boolean(errors.openingBalance)}
              fullWidth
              helperText={
                errors.openingBalance?.message ??
                onboardingCopy.accounts.balanceHelp
              }
              slotProps={{
                htmlInput: { inputMode: "decimal" },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      {onboardingCopy.accounts.amountPrefix}
                    </InputAdornment>
                  ),
                },
              }}
              label={onboardingCopy.accounts.balanceLabel}
            />
          )}
        />
        {!isOnline && (
          <p className="text-sm font-medium text-muted" role="status">
            {onboardingCopy.accounts.offlineContinue}
          </p>
        )}
        <Button
          className="min-h-11"
          disabled={!isOnline || isSubmitting || createAccount.isPending}
          type="submit"
          variant="outlined"
        >
          {isSubmitting || createAccount.isPending
            ? onboardingCopy.accounts.adding
            : onboardingCopy.accounts.add}
        </Button>
      </form>

      <section aria-labelledby="onboarding-added-accounts">
        <h2
          className="text-base font-semibold text-foreground"
          id="onboarding-added-accounts"
        >
          {onboardingCopy.accounts.added}
        </h2>
        {accounts.length > 0 ? (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {accounts.map((account) => (
              <li
                className="flex items-center justify-between gap-4 bg-panel px-4 py-3"
                key={account.id}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {account.name}
                  </span>
                  <span className="block text-sm capitalize text-muted">
                    {account.type.replace("_", " ")}
                  </span>
                </span>
                <span className="money shrink-0 font-semibold text-foreground">
                  {formatGhs(account.balance_minor)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3">
            <EmptyState
              description={onboardingCopy.accounts.emptyDescription}
              title={onboardingCopy.accounts.emptyTitle}
            />
          </div>
        )}
      </section>

      {accounts.length === 0 && (
        <p className="text-sm text-muted" role="status">
          {onboardingCopy.accounts.continueWithoutAccounts}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button className="min-h-11" onClick={onBack} variant="outlined">
          {onboardingCopy.navigation.back}
        </Button>
        <Button
          className="min-h-11"
          disabled={!isOnline || accounts.length === 0}
          onClick={onContinue}
          variant="contained"
        >
          {onboardingCopy.navigation.next}
        </Button>
      </div>
    </div>
  );
}
