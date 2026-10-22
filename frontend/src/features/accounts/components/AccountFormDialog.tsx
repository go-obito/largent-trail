"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import { X } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { formatGhs, parseGhsInput } from "@/lib/money";
import { uuidv7 } from "@/lib/uuid";
import { accountErrorMessage, accountFieldErrors } from "../errors";
import {
  useCreateAccount,
  useUpdateAccount,
  type UpdateAccountInput,
} from "../api";
import { showToast } from "@/lib/toast";

type AccountRead = components["schemas"]["AccountRead"];
type AccountType = components["schemas"]["AccountType"];

const accountTypes: { label: string; value: AccountType }[] = [
  { label: "Cash", value: "cash" },
  { label: "Bank", value: "bank" },
  { label: "Mobile money", value: "mobile_money" },
  { label: "Other", value: "other" },
];

const quickPicks: { name: string; type: AccountType }[] = [
  { name: "Cash", type: "cash" },
  { name: "MTN MoMo", type: "mobile_money" },
  { name: "Telecel Cash", type: "mobile_money" },
  { name: "AT Money", type: "mobile_money" },
  { name: "Bank account", type: "bank" },
];

const accountFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter an account name.")
    .max(60, "Use 60 characters or fewer."),
  type: z.enum(["cash", "bank", "mobile_money", "other"]),
  openingBalance: z
    .string()
    .trim()
    .refine(
      (value) => {
        const amount = parseGhsInput(value);
        return amount !== null && amount >= 0;
      },
      "Enter zero or a positive amount, with up to two decimal places.",
    ),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

type AccountFormDialogProps = {
  account: AccountRead | null;
  isOnline: boolean;
  onClose: () => void;
  onCreated?: (account: AccountRead) => void;
  open: boolean;
};

function openingBalanceInput(account: AccountRead | null) {
  return account
    ? formatGhs(account.opening_balance_minor).replace("₵", "")
    : "0.00";
}

export function AccountFormDialog({
  account,
  isOnline,
  onClose,
  onCreated,
  open,
}: AccountFormDialogProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [accountId] = useState(() => (account ? null : uuidv7()));
  const [submitError, setSubmitError] = useState("");
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: account?.name ?? "",
      type: account?.type ?? "cash",
      openingBalance: openingBalanceInput(account),
    },
  });
  const isPending = createAccount.isPending || updateAccount.isPending;

  async function submit(values: AccountFormValues) {
    setSubmitError("");
    const openingBalance = parseGhsInput(values.openingBalance);
    if (openingBalance === null || openingBalance < 0) {
      form.setError("openingBalance", {
        type: "validate",
        message: "Enter zero or a positive amount, with up to two decimal places.",
      });
      return;
    }

    const name = values.name.trim();
    try {
      if (account) {
        const changes: UpdateAccountInput["changes"] = {};
        if (name !== account.name) changes.name = name;
        if (values.type !== account.type) changes.type = values.type;
        if (openingBalance !== account.opening_balance_minor) {
          changes.opening_balance_minor = openingBalance;
        }

        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }

        await updateAccount.mutateAsync({ id: account.id, changes });
        showToast("Account updated", "success");
      } else {
        const created = await createAccount.mutateAsync({
          id: accountId ?? undefined,
          name,
          type: values.type,
          opening_balance_minor: openingBalance,
        });
        onCreated?.(created);
        showToast("Account added", "success");
      }
      onClose();
    } catch (error) {
      const fieldErrors = accountFieldErrors(error);
      if (fieldErrors.name) {
        form.setError("name", { type: "server", message: fieldErrors.name });
      }
      if (fieldErrors.type) {
        form.setError("type", { type: "server", message: fieldErrors.type });
      }
      if (fieldErrors.opening_balance_minor) {
        form.setError("openingBalance", {
          type: "server",
          message: fieldErrors.opening_balance_minor,
        });
      }
      if (error instanceof ApiError && error.code === "duplicate_name") {
        form.setError("name", {
          type: "server",
          message: accountErrorMessage(error),
        });
      }
      setSubmitError(accountErrorMessage(error));
    }
  }

  return (
    <Dialog
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      onClose={() => !isPending && onClose()}
      open={open}
    >
      <DialogTitle className="flex items-center justify-between gap-4">
        <span>{account ? "Edit account" : "Add account"}</span>
        <IconButton
          aria-label="Close account form"
          disabled={isPending}
          onClick={onClose}
          sx={{ minHeight: 44, minWidth: 44 }}
        >
          <X aria-hidden="true" size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent className="space-y-5 pt-2">
        {submitError && (
          <Alert aria-live="polite" severity="error">
            {submitError}
          </Alert>
        )}
        {!isOnline && (
          <Alert aria-live="polite" severity="info">
            You&apos;re offline. Connect to save account changes.
          </Alert>
        )}
        {!account && (
          <div aria-label="Account quick picks" className="space-y-3" role="group">
            <p className="text-sm font-medium text-foreground">
              Start with a common account
            </p>
            <div className="flex flex-wrap gap-2">
              {quickPicks.map((pick) => (
                <Chip
                  clickable
                  key={pick.name}
                  label={pick.name}
                  onClick={() => {
                    form.setValue("name", pick.name, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    form.setValue("type", pick.type, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setSubmitError("");
                  }}
                  sx={{ minHeight: 44 }}
                  variant="outlined"
                />
              ))}
            </div>
          </div>
        )}
        <form
          className="space-y-5"
          id="account-form"
          onSubmit={form.handleSubmit(submit)}
        >
          <Controller
            control={form.control}
            name="name"
            render={({ field }) => (
              <TextField
                {...field}
                autoComplete="off"
                error={Boolean(form.formState.errors.name)}
                fullWidth
                helperText={
                  <span aria-live="polite">
                    {form.formState.errors.name?.message ??
                      "Use 1 to 60 characters."}
                  </span>
                }
                label="Name"
                slotProps={{ htmlInput: { maxLength: 60 } }}
              />
            )}
          />
          <FormControl
            error={Boolean(form.formState.errors.type)}
            fullWidth
          >
            <InputLabel id="account-type-label">Type</InputLabel>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select
                  {...field}
                  label="Type"
                  labelId="account-type-label"
                >
                  {accountTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
            <FormHelperText aria-live="polite">
              {form.formState.errors.type?.message}
            </FormHelperText>
          </FormControl>
          <TextField
            {...form.register("openingBalance")}
            error={Boolean(form.formState.errors.openingBalance)}
            fullWidth
            helperText={
              <span aria-live="polite">
                {form.formState.errors.openingBalance?.message ??
                  (account
                    ? "Changing this changes this account's balance and your total."
                    : "Enter zero or a positive amount, with up to two decimal places.")}
              </span>
            }
            label="Opening balance"
            slotProps={{
              htmlInput: { inputMode: "decimal" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">₵</InputAdornment>
                ),
              },
            }}
          />
        </form>
      </DialogContent>
      <DialogActions className="sticky bottom-0 z-10 border-t border-outline bg-surface px-6 py-4 md:static md:border-0">
        <Button
          disabled={isPending}
          onClick={onClose}
          sx={{ minHeight: 44 }}
        >
          Cancel
        </Button>
        <Button
          disabled={!isOnline || isPending}
          form="account-form"
          sx={{ minHeight: 44 }}
          type="submit"
          variant="contained"
        >
          {isPending
            ? account
              ? "Saving…"
              : "Adding…"
            : account
              ? "Save changes"
              : "Add account"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
