"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import { useState } from "react";
import { useAccounts } from "@/features/accounts/api";
import { useCategories } from "@/features/categories/api";
import { useMe } from "@/features/me/api";
import { useDeleteNeed } from "@/features/needs/api";
import { needErrorMessage } from "@/features/needs/errors";
import type { components } from "@/lib/api/schema";
import { addDaysToDate, dateInTimezone, isCalendarDate } from "@/lib/date";
import { formatGhs } from "@/lib/money";
import { showToast } from "@/lib/toast";

type NeedRead = components["schemas"]["NeedRead"];

export function NeedDeleteDialog({
  isOnline,
  need,
  onClose,
  onDeleted,
}: {
  isOnline: boolean;
  need: NeedRead;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const remove = useDeleteNeed();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const [stage, setStage] = useState<"confirm" | "reconcile" | "purchase">(
    "confirm",
  );
  const [error, setError] = useState<string | null>(null);

  async function deleteNeed(
    options: {
      reconcile?: "release" | "purchased";
      account_id?: string;
      category_id?: string;
      occurred_on?: string;
    } = {},
  ) {
    setError(null);
    try {
      await remove.mutateAsync({ id: need.id, ...options });
      showToast(
        options.reconcile === "purchased"
          ? "Need deleted and purchase recorded"
          : options.reconcile === "release"
            ? "Need deleted and money returned to unallocated savings"
            : "Need deleted",
        "success",
      );
      onDeleted();
    } catch (cause) {
      if (
        stage === "confirm" &&
        cause instanceof Error &&
        "code" in cause &&
        cause.code === "allocation_outstanding"
      ) {
        setStage("reconcile");
        return;
      }
      setError(needErrorMessage(cause));
    }
  }

  return (
    <Dialog
      fullWidth
      fullScreen={isPhone}
      maxWidth="sm"
      onClose={() => !remove.isPending && onClose()}
      open
      slotProps={{
        paper: {
          sx: {
            borderRadius: isPhone ? 0 : "var(--radius-card)",
            maxWidth: isPhone ? "none" : 520,
          },
        },
      }}
    >
      <DialogTitle>
        {stage === "confirm"
          ? "Delete this need?"
          : stage === "reconcile"
            ? "Reconcile money set aside"
            : "Record the purchase"}
      </DialogTitle>
      <DialogContent className="space-y-4 pt-2">
        <p className="text-sm leading-6 text-muted">
          {stage === "confirm"
            ? `Delete ${need.name}? If money is set aside, you'll choose how to reconcile it next.`
            : stage === "reconcile"
              ? `${formatGhs(need.allocated_minor)} is set aside for ${need.name}. Choose how to reconcile it before deleting this need.`
              : `Record ${formatGhs(need.allocated_minor)} as an expense from an account, then delete this need.`}
        </p>
        {!isOnline && (
          <Alert severity="info">
            You&apos;re offline. Changes need a connection.
          </Alert>
        )}
        {error && (
          <Alert aria-live="polite" severity="error">
            {error}
          </Alert>
        )}
        {stage === "purchase" && (
          <PurchaseReconcileFields
            disabled={!isOnline || remove.isPending}
            onCancel={onClose}
            onSubmit={(purchase) => void deleteNeed({
              reconcile: "purchased",
              ...purchase,
            })}
            pending={remove.isPending}
          />
        )}
      </DialogContent>
      {stage !== "purchase" && (
        <DialogActions className="flex-wrap px-6 pb-5">
          <Button
            disabled={remove.isPending}
            onClick={onClose}
            sx={{ minHeight: 44 }}
          >
            Cancel
          </Button>
          {stage === "confirm" ? (
            <Button
              color="error"
              disabled={!isOnline || remove.isPending}
              onClick={() => void deleteNeed()}
              sx={{ minHeight: 44 }}
              variant="contained"
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          ) : (
            <>
              <Button
                disabled={!isOnline || remove.isPending}
                onClick={() => void deleteNeed({ reconcile: "release" })}
                sx={{ minHeight: 44 }}
                variant="outlined"
              >
                Return {formatGhs(need.allocated_minor)} to my unallocated savings
              </Button>
              <Button
                disabled={!isOnline || remove.isPending}
                onClick={() => setStage("purchase")}
                sx={{ minHeight: 44 }}
                variant="contained"
              >
                I bought it, record an expense
              </Button>
            </>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}

function PurchaseReconcileFields({
  disabled,
  onCancel,
  onSubmit,
  pending,
}: {
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (purchase: {
    account_id: string;
    category_id?: string;
    occurred_on: string;
  }) => void;
  pending: boolean;
}) {
  const accounts = useAccounts();
  const categories = useCategories({ kind: "expense" });
  const me = useMe();
  const timezone = me.data?.timezone || "Africa/Accra";
  const today = dateInTimezone(new Date(), timezone);
  const latestDate = addDaysToDate(today, 1);
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [occurredOnOverride, setOccurredOnOverride] = useState<string | null>(
    null,
  );
  const occurredOn = occurredOnOverride ?? today;
  const accountList = accounts.data ?? [];
  const categoryList = categories.data ?? [];
  const isDateValid =
    isCalendarDate(occurredOn) &&
    occurredOn >= "2000-01-01" &&
    occurredOn <= latestDate;
  const canSubmit =
    accountId.length > 0 &&
    !accounts.isPending &&
    !accounts.isError &&
    accountList.length > 0 &&
    isDateValid;

  return (
    <>
      {accounts.isPending && (
        <p className="text-sm text-muted">Loading active accounts…</p>
      )}
      {accounts.isError && (
        <Alert
          action={
            <Button
              color="inherit"
              onClick={() => void accounts.refetch()}
              size="small"
            >
              Try again
            </Button>
          }
          severity="error"
        >
          Accounts could not be loaded.
        </Alert>
      )}
      {!accounts.isPending && !accounts.isError && accountList.length === 0 && (
        <Alert
          action={
            <Button
              component={Link}
              href="/profile/accounts"
              color="inherit"
              size="small"
            >
              Add account
            </Button>
          }
          severity="info"
        >
          Add an active account before recording this purchase.
        </Alert>
      )}
      <FormControl disabled={disabled || accountList.length === 0} fullWidth>
        <InputLabel id="need-purchase-account-label">Account</InputLabel>
        <Select
          label="Account"
          labelId="need-purchase-account-label"
          onChange={(event) => setAccountId(event.target.value)}
          value={accountId}
        >
          {accountList.map((account) => (
            <MenuItem key={account.id} value={account.id}>
              {account.name}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>Required to record the expense</FormHelperText>
      </FormControl>
      <FormControl
        disabled={disabled || categories.isPending || categories.isError}
        fullWidth
      >
        <InputLabel id="need-purchase-category-label">
          Expense category
        </InputLabel>
        <Select
          label="Expense category"
          labelId="need-purchase-category-label"
          onChange={(event) => setCategoryId(event.target.value)}
          value={categoryId}
        >
          <MenuItem value="">Uncategorized</MenuItem>
          {categoryList.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              {category.name}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          {categories.isError
            ? "Categories unavailable; the purchase can be left uncategorized."
            : "Optional"}
        </FormHelperText>
      </FormControl>
      <TextField
        error={Boolean(occurredOn) && !isDateValid}
        fullWidth
        helperText={
          isDateValid
            ? "Defaults to today in your timezone."
            : `Choose a date from 2000-01-01 through ${latestDate}.`
        }
        label="Date purchased"
        required
        onChange={(event) => setOccurredOnOverride(event.target.value)}
        slotProps={{
          formHelperText: { "aria-live": "polite" },
          htmlInput: { min: "2000-01-01", max: latestDate, required: true },
        }}
        type="date"
        value={occurredOn}
      />
      <DialogActions className="-mx-6 -mb-5 border-t border-outline px-6 py-4">
        <Button disabled={pending} onClick={onCancel} sx={{ minHeight: 44 }}>
          Cancel
        </Button>
        <Button
          disabled={disabled || pending || !canSubmit}
          onClick={() =>
            onSubmit({
              account_id: accountId,
              ...(categoryId ? { category_id: categoryId } : {}),
              occurred_on: occurredOn,
            })
          }
          sx={{ minHeight: 44 }}
          variant="contained"
        >
          {pending ? "Recording…" : "Record purchase"}
        </Button>
      </DialogActions>
    </>
  );
}
