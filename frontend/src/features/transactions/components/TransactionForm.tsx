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
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  Controller,
  useForm,
  useWatch,
} from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/states/EmptyState";
import { CategoryBadge } from "@/components/CategoryBadge";
import { CategoryFormDialog } from "@/components/CategoryFormDialog";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { AccountFormDialog } from "@/features/accounts/components/AccountFormDialog";
import { useAccounts } from "@/features/accounts/api";
import { useCategories } from "@/features/categories/api";
import { dateInTimezone } from "@/lib/date";
import { useMe } from "@/features/me/api";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransaction,
  useUpdateTransaction,
} from "@/features/transactions/api";
import {
  transactionErrorMessage,
  transactionFieldErrors,
} from "@/features/transactions/errors";
import { ApiError } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { parseGhsInput } from "@/lib/money";
import { showToast } from "@/lib/toast";

type TransactionKind = components["schemas"]["CategoryKind"];
type AccountRead = components["schemas"]["AccountRead"];
type CategoryRead = components["schemas"]["CategoryRead"];
type TransactionRead = components["schemas"]["TransactionRead"];

const transactionSchema = z.object({
  kind: z.enum(["expense", "income"]),
  amount: z
    .string()
    .trim()
    .min(1, "Enter an amount.")
    .refine(
      (value) => {
        const parsed = parseGhsInput(value);
        return parsed !== null && parsed > 0;
      },
      "Enter an amount greater than zero, with up to two decimal places.",
    ),
  account_id: z.string().min(1, "Choose an account."),
  category_id: z.string(),
  merchant: z.string(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  note: z.string().max(280, "Notes can be up to 280 characters."),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

type MerchantGroup = "food" | "transport" | "entertainment" | "airtime-data";

const MERCHANT_OPTIONS: Record<MerchantGroup, readonly string[]> = {
  food: ["McDonald's", "Starbucks", "KFC", "Papaye", "Restaurant / food vendor", "Grocery shop", "Market vendor"],
  transport: ["Uber", "Bolt", "Yango", "Trotro", "Taxi", "Shell", "TotalEnergies", "Fuel station"],
  entertainment: ["Netflix", "Spotify", "YouTube", "DStv", "Showmax", "Apple", "Google Play", "Cinema", "Gaming service"],
  "airtime-data": ["MTN Ghana", "Telecel Ghana", "AT Ghana", "Other network"],
};

function getMerchantGroup(categoryName: string): MerchantGroup | null {
  const name = categoryName.normalize("NFKC").trim().toLocaleLowerCase();
  if (/food|restaurant|dining|grocer|meal|eatery|catering/.test(name)) return "food";
  if (/transport|transit|taxi|ride|fuel|petrol|trotro|commut/.test(name)) return "transport";
  if (/entertain|stream|subscription|music|movie|cinema|gaming/.test(name)) return "entertainment";
  if (/airtime|\\bdata\\b|internet bundle|telecom/.test(name)) return "airtime-data";
  return null;
}

const ALL_MERCHANTS = Object.values(MERCHANT_OPTIONS).flat().concat("Other");

function getStoredMerchant(note: string): string {
  const normalized = note.normalize("NFKC").trim().toLocaleLowerCase();
  const match = ALL_MERCHANTS.find((merchant) =>
    normalized === merchant.toLocaleLowerCase() ||
    normalized.startsWith(`${merchant.toLocaleLowerCase()} ·`),
  );
  if (!match) return "";
  return match;
}

function stripStoredMerchant(note: string): string {
  const merchant = getStoredMerchant(note);
  if (!merchant) return note;
  return note.slice(merchant.length).replace(/^\\s*·\\s*/, "").trim();
}

type TransactionFormProps = {
  mode: "create" | "edit";
  initialKind?: TransactionKind;
  transactionId?: string;
};

type TransactionFormEditorProps = TransactionFormProps & {
  transaction?: TransactionRead;
};

function addOneDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function isMissingTransaction(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

export function TransactionForm({
  mode,
  initialKind = "expense",
  transactionId = "",
}: TransactionFormProps) {
  const isEditing = mode === "edit";
  const transactionQuery = useTransaction(isEditing ? transactionId : "");
  if (isEditing && transactionQuery.isPending) {
    return <LoadingSkeleton label="Loading transaction" rows={3} />;
  }
  if (
    isEditing &&
    transactionQuery.isError &&
    isMissingTransaction(transactionQuery.error)
  ) {
    return (
      <div className="space-y-4">
        <EmptyState
          description="This transaction may have been deleted or you may not have access to it."
          title="Transaction not found"
        />
        <Button component={Link} href="/transactions" variant="outlined">
          Back to transactions
        </Button>
      </div>
    );
  }
  if (isEditing && transactionQuery.isError) {
    return (
      <ErrorState
        description="We couldn't load this transaction. Check your connection and try again."
        onRetry={() => void transactionQuery.refetch()}
      />
    );
  }
  if (isEditing && !transactionQuery.data) {
    return <LoadingSkeleton label="Preparing transaction form" rows={3} />;
  }

  return (
    <TransactionFormEditor
      key={isEditing ? transactionQuery.data?.id : "new-transaction"}
      initialKind={initialKind}
      mode={mode}
      transaction={transactionQuery.data}
      transactionId={transactionId}
    />
  );
}

function TransactionFormEditor({
  mode,
  initialKind = "expense",
  transaction,
  transactionId = "",
}: TransactionFormEditorProps) {
  const router = useRouter();
  const isEditing = mode === "edit";
  const accountQuery = useAccounts();
  const meQuery = useMe();
  const [isOnline, setIsOnline] = useState(true);
  const [submitMessage, setSubmitMessage] = useState("");
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<AccountRead | null>(null);
  const [createdCategory, setCreatedCategory] = useState<CategoryRead | null>(null);
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      kind: transaction?.kind ?? initialKind,
      amount: transaction ? minorToInput(transaction.amount_minor) : "",
      account_id: transaction?.account_id ?? "",
      category_id: transaction?.category_id ?? "",
      merchant: getStoredMerchant(transaction?.note ?? ""),
      occurred_on: transaction?.occurred_on ?? "",
      note: stripStoredMerchant(transaction?.note ?? ""),
    },
  });
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const kind = useWatch({ control: form.control, name: "kind" });
  const categoryId = useWatch({ control: form.control, name: "category_id" });
  const note = useWatch({ control: form.control, name: "note" });
  const categoryQuery = useCategories({ kind });
  const timezone = meQuery.data?.timezone || "Africa/Accra";
  const today = useMemo(() => dateInTimezone(new Date(), timezone), [timezone]);
  const latestDate = useMemo(() => addOneDay(today), [today]);
  const accounts = useMemo(() => accountQuery.data ?? [], [accountQuery.data]);
  const categories = categoryQuery.data ?? [];
  const categoryOptions = [
    ...categories,
    ...(createdCategory &&
    createdCategory.kind === kind &&
    !categories.some(({ id }) => id === createdCategory.id)
      ? [createdCategory]
      : []),
  ];
  const isPending =
    createTransaction.isPending || updateTransaction.isPending || deleteTransaction.isPending;
  const offlineMessage = !isOnline
    ? "You're offline. Changes need a connection."
    : "";

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!isEditing && !form.getFieldState("occurred_on").isDirty) {
      form.setValue("occurred_on", today);
    }
  }, [form, isEditing, today]);

  const archivedAccount =
    transaction && transaction.account_id === form.getValues("account_id") &&
    !accounts.some((account) => account.id === transaction.account_id)
      ? { id: transaction.account_id, name: transaction.account_name }
      : null;
  const selectedArchivedCategory =
    transaction &&
    transaction.kind === kind &&
    transaction.category_id === form.getValues("category_id") &&
    transaction.category_id &&
    !categories.some((category) => category.id === transaction.category_id)
      ? {
          id: transaction.category_id,
          name: transaction.category_name ?? "Category",
        }
      : null;
  const selectedCategoryName = categories.find(({ id }) => id === categoryId)?.name ??
    (selectedArchivedCategory?.id === categoryId ? selectedArchivedCategory.name : "");
  const merchantGroup = getMerchantGroup(selectedCategoryName);
  const merchantOptions = merchantGroup ? MERCHANT_OPTIONS[merchantGroup] : [];
  const accountOptions = [
    ...accounts,
    ...(createdAccount && !accounts.some(({ id }) => id === createdAccount.id)
      ? [createdAccount]
      : []),
  ];
  const hasAccountOption = accountOptions.length > 0 || Boolean(archivedAccount);

  async function submit(values: TransactionFormValues) {
    setSubmitMessage("");
    try {
      if (merchantGroup && !values.merchant.trim()) {
        form.setError("merchant", { type: "validate", message: "Choose a merchant for this category." });
        return;
      }
      const amountMinor = parseGhsInput(values.amount);
      if (amountMinor === null || amountMinor <= 0) {
        form.setError("amount", {
          type: "validate",
          message: "Enter an amount greater than zero, with up to two decimal places.",
        });
        return;
      }
      if (
        values.occurred_on < "2000-01-01" ||
        values.occurred_on > latestDate
      ) {
        form.setError("occurred_on", {
          type: "validate",
          message: `Choose a date from 2000-01-01 through ${latestDate}.`,
        });
        return;
      }
      const combinedNote = [values.merchant.trim(), values.note.trim()].filter(Boolean).join(" · ");
      if (combinedNote.length > 280) {
        form.setError("note", { type: "validate", message: "Merchant and note together must be 280 characters or fewer." });
        return;
      }
      const data = {
        account_id: values.account_id,
        category_id: values.category_id || null,
        kind: values.kind,
        amount_minor: amountMinor,
        occurred_on: values.occurred_on,
        note: values.note.trim() || null,
      };

      if (isEditing) {
        await updateTransaction.mutateAsync({
          id: transactionId,
          changes: data,
        });
      } else {
        await createTransaction.mutateAsync({
          ...data,
          currency: "GHS",
        });
      }
      router.back();
    } catch (error) {
      setSubmitMessage(transactionErrorMessage(error));
      for (const [field, message] of Object.entries(transactionFieldErrors(error))) {
        const formField = serverFieldMap[field];
        if (formField) {
          form.setError(formField, { type: "server", message });
        }
      }
    }
  }

  async function confirmDelete() {
    try {
      await deleteTransaction.mutateAsync(transactionId);
      showToast("Transaction deleted", "success");
      router.replace("/transactions");
    } catch (error) {
      setSubmitMessage(transactionErrorMessage(error));
      setIsDeleteDialogOpen(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-[560px] pb-28 md:pb-4">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Transactions
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {isEditing ? "Edit transaction" : "Add transaction"}
        </h1>
      </header>

      {submitMessage && (
        <Alert aria-live="polite" className="mb-4" severity="error">
          {submitMessage}
        </Alert>
      )}
      {offlineMessage && (
        <Alert aria-live="polite" className="mb-4" severity="info">
          {offlineMessage}
        </Alert>
      )}

      <form className="card-surface space-y-5 p-5 md:p-6" noValidate onSubmit={form.handleSubmit(submit)}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">Transaction type</legend>
          <div
            aria-label="Transaction type"
            className="grid grid-cols-2 rounded-2xl bg-panel-raised p-1"
            role="group"
          >
            {(["expense", "income"] as TransactionKind[]).map((value) => (
              <button
                key={value}
                aria-pressed={kind === value}
                className={`min-h-11 rounded-xl px-4 font-semibold capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  kind === value
                    ? "bg-panel text-foreground shadow-sm"
                    : "text-muted hover:bg-panel/60"
                }`}
                onClick={() => {
                  form.setValue("kind", value, { shouldValidate: true });
                  form.setValue("category_id", "", { shouldValidate: true });
                  form.setValue("merchant", "", { shouldValidate: true });
                  setCreatedCategory(null);
                }}
                type="button"
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>

        <TextField
          {...form.register("amount")}
          autoFocus={!isEditing}
          error={Boolean(form.formState.errors.amount)}
          fullWidth
          helperText={
            <span aria-live="polite">{form.formState.errors.amount?.message}</span>
          }
          label="Amount"
          placeholder="0.00"
          slotProps={{
            input: { startAdornment: <InputAdornment position="start">₵</InputAdornment> },
            htmlInput: { inputMode: "decimal" },
          }}
          sx={{
            "& .MuiInputBase-input": { fontSize: "1.5rem", fontWeight: 700, minHeight: 44 },
          }}
        />

        {accountQuery.isError ? (
          <Alert
            action={
              <Button color="inherit" onClick={() => void accountQuery.refetch()} size="small">
                Try again
              </Button>
            }
            severity="error"
          >
            Accounts could not be loaded.
          </Alert>
        ) : accountQuery.isSuccess && !hasAccountOption ? (
          <section className="space-y-3 rounded-2xl border border-outline bg-panel p-4">
            <div>
              <h2 className="font-semibold text-foreground">Create your first account</h2>
              <p className="mt-1 text-sm text-muted">
                Accounts keep your transactions organized.
              </p>
            </div>
            <Button
              disabled={!isOnline}
              fullWidth
              onClick={() => setIsAccountDialogOpen(true)}
              sx={{ minHeight: 44 }}
              variant="outlined"
            >
              Create account
            </Button>
          </section>
        ) : (
          <FormControl
            disabled={accountQuery.isPending}
            error={Boolean(form.formState.errors.account_id)}
            fullWidth
          >
            <InputLabel id="transaction-account-label">Account</InputLabel>
            <Controller
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <Select
                  {...field}
                  id="transaction-account"
                  label="Account"
                  labelId="transaction-account-label"
                  onChange={(event: SelectChangeEvent<string>) => {
                    if (event.target.value === "__create_new_account__") {
                      setIsAccountDialogOpen(true);
                      return;
                    }
                    field.onChange(event);
                  }}
                  sx={{ minHeight: 44 }}
                >
                  {accountQuery.isPending && (
                    <MenuItem disabled value="">
                      Loading accounts…
                    </MenuItem>
                  )}
                  {accountOptions.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name}
                      {archivedAccount?.id === account.id ? " (archived)" : ""}
                    </MenuItem>
                  ))}
                  {archivedAccount &&
                    !accountOptions.some(({ id }) => id === archivedAccount.id) && (
                      <MenuItem value={archivedAccount.id}>
                        {archivedAccount.name} (archived)
                      </MenuItem>
                    )}
                  <MenuItem value="__create_new_account__">+ New account</MenuItem>
                </Select>
              )}
            />
            <FormHelperText aria-live="polite">
              {form.formState.errors.account_id?.message}
            </FormHelperText>
          </FormControl>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">Category</legend>
          {categoryQuery.isError ? (
            <Alert
              action={
                <Button
                  color="inherit"
                  onClick={() => void categoryQuery.refetch()}
                  size="small"
                >
                  Try again
                </Button>
              }
              severity="error"
            >
              Categories could not be loaded.
            </Alert>
          ) : (
            <div aria-label="Category" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <CategoryChoice
                isSelected={!categoryId}
                label="Uncategorized"
                onSelect={() => { form.setValue("category_id", "", { shouldValidate: true }); form.setValue("merchant", "", { shouldValidate: true }); }}
              />
              {categoryOptions.map((category) => (
                <CategoryChoice
                  key={category.id}
                  isSelected={categoryId === category.id}
                  label={category.name}
                  icon={category.icon}
                  onSelect={() =>
                    { form.setValue("category_id", category.id, { shouldValidate: true }); form.setValue("merchant", "", { shouldValidate: true }); }
                  }
                />
              ))}
              {selectedArchivedCategory && (
                <CategoryChoice
                  isSelected
                  label={`${selectedArchivedCategory.name} (archived)`}
                  onSelect={() =>
                    form.setValue("category_id", selectedArchivedCategory.id, {
                      shouldValidate: true,
                    })
                  }
                />
              )}
              <CategoryChoice
                isAction
                isSelected={false}
                label="+ New"
                onSelect={() => setIsCategoryDialogOpen(true)}
              />
            </div>
          )}
          <span aria-live="polite" className="sr-only">
            {form.formState.errors.category_id?.message}
          </span>
        </fieldset>

        {merchantGroup && (
          <FormControl fullWidth error={Boolean(form.formState.errors.merchant)}>
            <InputLabel id="transaction-merchant-label">Merchant</InputLabel>
            <Controller
              control={form.control}
              name="merchant"
              render={({ field }) => (
                <Select
                  {...field}
                  id="transaction-merchant"
                  label="Merchant"
                  labelId="transaction-merchant-label"
                  onChange={(event: SelectChangeEvent<string>) => field.onChange(event.target.value)}
                  sx={{ minHeight: 44 }}
                >
                  <MenuItem value="">Choose a merchant</MenuItem>
                  {merchantOptions.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              )}
            />
            <FormHelperText>
              {form.formState.errors.merchant?.message ??
                "Choose the business or service you paid."}
            </FormHelperText>
          </FormControl>
        )}

        <TextField
          {...form.register("occurred_on")}
          error={Boolean(form.formState.errors.occurred_on)}
          fullWidth
          helperText={
            <span aria-live="polite">{form.formState.errors.occurred_on?.message}</span>
          }
          label="Date"
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { min: "2000-01-01", max: latestDate },
          }}
          type="date"
        />

        <TextField
          {...form.register("note")}
          error={Boolean(form.formState.errors.note)}
          fullWidth
          helperText={
            <span aria-live="polite">
              {form.formState.errors.note?.message ??
                `${note.length}/280 characters`}
            </span>
          }
          label="Note (optional)"
          multiline
          minRows={2}
          slotProps={{ htmlInput: { maxLength: 280 } }}
        />

        {isEditing && (
          <Button
            color="error"
            disabled={isPending || !isOnline}
            onClick={() => setIsDeleteDialogOpen(true)}
            sx={{ minHeight: 44 }}
            variant="outlined"
          >
            Delete transaction
          </Button>
        )}

        <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 -mx-5 mt-6 bg-page/95 px-5 pt-3 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:pb-0 md:backdrop-blur-none">
          <Button
            disabled={isPending || !isOnline || (accountQuery.isSuccess && !hasAccountOption)}
            fullWidth
            sx={{ minHeight: 48 }}
            type="submit"
            variant="contained"
          >
            {isPending
              ? isEditing
                ? "Saving…"
                : "Adding…"
              : isEditing
                ? "Save changes"
                : "Add transaction"}
          </Button>
          {!isOnline && (
            <p aria-live="polite" className="mt-2 text-center text-sm text-muted">
              You&apos;re offline. Changes need a connection.
            </p>
          )}
        </div>
      </form>

      <AccountFormDialog
        account={null}
        isOnline={isOnline}
        onClose={() => setIsAccountDialogOpen(false)}
        onCreated={(account) => {
          setCreatedAccount(account);
          form.setValue("account_id", account.id, { shouldValidate: true });
        }}
        open={isAccountDialogOpen}
      />
      {isCategoryDialogOpen && (
        <CategoryFormDialog
          initialKind={kind}
          onClose={() => setIsCategoryDialogOpen(false)}
          onCreated={(category) => {
            setCreatedCategory(category);
            form.setValue("category_id", category.id, { shouldValidate: true });
          }}
          open
        />
      )}

      <Dialog
        onClose={() => setIsDeleteDialogOpen(false)}
        open={isDeleteDialogOpen}
      >
        <DialogTitle>Delete this transaction?</DialogTitle>
        <DialogContent>
          <p className="text-sm text-muted">This action can&apos;t be undone.</p>
        </DialogContent>
        <DialogActions className="px-6 pb-5">
          <Button
            disabled={deleteTransaction.isPending}
            onClick={() => setIsDeleteDialogOpen(false)}
            sx={{ minHeight: 44 }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            disabled={deleteTransaction.isPending || !isOnline}
            onClick={() => void confirmDelete()}
            sx={{ minHeight: 44 }}
            variant="contained"
          >
            {deleteTransaction.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}

const serverFieldMap: Record<string, keyof TransactionFormValues> = {
  kind: "kind",
  amount_minor: "amount",
  account_id: "account_id",
  category_id: "category_id",
  occurred_on: "occurred_on",
  note: "note",
};

function minorToInput(amountMinor: number) {
  const whole = Math.floor(amountMinor / 100).toString();
  const fraction = (amountMinor % 100).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function CategoryChoice({
  icon,
  isAction = false,
  isSelected,
  label,
  onSelect,
}: {
  icon?: string | null;
  isAction?: boolean;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
        isSelected
          ? "border-primary bg-selected text-foreground"
          : "border-outline bg-panel text-foreground hover:bg-panel-raised"
      }`}
      onClick={onSelect}
      type="button"
    >
      {isAction ? (
        <Plus aria-hidden="true" size={18} />
      ) : (
        <CategoryBadge icon={icon} name={label} size={36} />
      )}
      {label}
    </button>
  );
}
