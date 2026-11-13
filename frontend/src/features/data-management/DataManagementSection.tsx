"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { useAuth } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle2, Download, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearPersistedQueryCache } from "@/app/providers";

type ResetKind = "activity" | "all" | null;

async function fetchBackupRows(
  baseUrl: string,
  token: string,
  path: string,
  paginated = true,
): Promise<Array<{ section: string; record: unknown }>> {
  const rows: Array<{ section: string; record: unknown }> = [];
  let cursor: string | undefined;

  do {
    const url = new URL(path, baseUrl);
    if (paginated) {
      url.searchParams.set("limit", "200");
      if (cursor) url.searchParams.set("cursor", cursor);
    }
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error("We couldn't prepare your CSV backup. Please try again.");
    }
    const payload: unknown = await response.json();
    const page = payload as {
      items?: unknown[];
      next_cursor?: string | null;
    };
    const records = Array.isArray(payload)
      ? payload
      : Array.isArray(page.items)
        ? page.items
        : payload == null
          ? []
          : [payload];
    rows.push(...records.map((record) => ({ section: path.split("/").at(-1) ?? path, record })));
    cursor = paginated ? page.next_cursor ?? undefined : undefined;
  } while (cursor);

  return rows;
}

function csvCell(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function DataManagementSection() {
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirming, setConfirming] = useState<ResetKind>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const downloadBackup = async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      if (!navigator.onLine) throw new Error("Connect to the internet before downloading your backup.");
      const token = await getToken({ skipCache: true });
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!token || !baseUrl) throw new Error("Your session could not be verified. Please sign in again.");

      const sections = await Promise.all([
        fetchBackupRows(baseUrl, token, "/v1/transactions"),
        fetchBackupRows(baseUrl, token, "/v1/accounts"),
        fetchBackupRows(baseUrl, token, "/v1/budgets"),
        fetchBackupRows(baseUrl, token, "/v1/needs", false),
        fetchBackupRows(baseUrl, token, "/v1/categories", false),
      ]);
      const rows = sections.flat();
      const csv = [
        ["Record type", "Record data"].map(csvCell).join(","),
        ...rows.map(({ section, record }) => [section, record].map(csvCell).join(",")),
      ].join("\r\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `largent-financial-backup-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setNotice("Your CSV backup has been downloaded.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't prepare your CSV backup.");
    } finally {
      setExporting(false);
    }
  };

  const openResetDialog = () => {
    setError(null);
    setConfirmationText("");
    setConfirming("all");
  };

  const runReset = async () => {
    if (!confirming || busy || !userId) return;
    if (confirming === "all" && confirmationText !== "RESET") return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (!navigator.onLine) throw new Error("Connect to the internet before resetting data.");
      const token = await getToken({ skipCache: true });
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!token || !baseUrl) throw new Error("Your session could not be verified. Please sign in again.");
      const response = await fetch(`${baseUrl}/v1/data/${confirming}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("We couldn't reset your financial data. Please try again.");
      setConfirming(null);
      if (confirming === "all") {
        try {
          localStorage.setItem(`largent-query-cache-reset:${userId}`, "1");
          localStorage.removeItem(`largent-onboarding:${userId}`);
        } catch (storageError) {
          console.error("Failed to mark or clear local state after reset.", storageError);
        }
        queryClient.clear();
        void clearPersistedQueryCache(userId).catch((storageError: unknown) => {
          console.error("Failed to clear persisted query cache after reset.", storageError);
        });
        router.replace("/onboarding");
      } else {
        await queryClient.invalidateQueries();
        setNotice("Activity cleared. Your accounts, budgets and priorities are unchanged.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const allResetReady = confirmationText === "RESET" && !busy;

  return (
    <section aria-labelledby="data-management-heading" className="card-surface space-y-4 p-5">
      <div>
        <h2 className="text-sm font-bold text-foreground" id="data-management-heading">Data management</h2>
        <p className="mt-1 text-sm text-muted">Reset your financial activity or start your Largent setup again.</p>
      </div>
      <div className="rounded-2xl border border-outline p-4">
        <div className="flex items-start gap-3">
          <RotateCcw aria-hidden="true" className="mt-0.5 shrink-0 text-muted" size={19} />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">Reset activity</h3>
            <p className="mt-1 text-sm text-muted">Clear all income and spending entries and reset budget progress. Keep your accounts, categories, budgets and priorities.</p>
            <Button className="mt-3" onClick={() => { setError(null); setConfirming("activity"); }} sx={{ minHeight: 40 }} variant="outlined">Reset activity</Button>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-status-error/40 p-4">
        <div className="flex items-start gap-3">
          <Trash2 aria-hidden="true" className="mt-0.5 shrink-0 text-status-error" size={19} />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">Clear all financial data</h3>
            <p className="mt-1 text-sm text-muted">Clear transactions, account balances, budgets, categories, accounts and priorities. Temporary statement previews and import summaries are cleared. Immutable savings-allocation audit history is retained.</p>
            <Button className="mt-3" color="error" onClick={openResetDialog} sx={{ minHeight: 40 }} variant="outlined">Clear all financial data</Button>
          </div>
        </div>
      </div>
      {notice && <p aria-live="polite" className="text-sm text-status-success" role="status">{notice}</p>}
      {error && <p aria-live="assertive" className="text-sm text-status-error" role="alert">{error}</p>}
      <Dialog
        aria-labelledby="reset-all-title"
        fullWidth
        maxWidth="sm"
        onClose={() => !busy && setConfirming(null)}
        open={confirming === "all"}
        slotProps={{ paper: { sx: { borderRadius: "24px", p: { xs: 0.5, sm: 1 }, bgcolor: "background.paper" } } }}
      >
        <DialogTitle className="px-5 pt-5 sm:px-6 sm:pt-6" id="reset-all-title">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-status-error/10 text-status-error">
            <AlertTriangle aria-hidden="true" size={22} />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">Reset all your financial data?</span>
        </DialogTitle>
        <DialogContent className="space-y-5 px-5 pb-3 sm:px-6">
          <p className="text-sm leading-6 text-muted">
            This will clear all your money records so you can start fresh. Your Largent account will stay active, and you will remain signed in.
          </p>

          <div className="rounded-2xl border border-status-error/20 bg-status-error/5 p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">What will be cleared:</h3>
            <ul className="space-y-2 text-sm leading-5 text-muted">
              <li className="flex gap-2"><Trash2 aria-hidden="true" className="mt-0.5 shrink-0 text-status-error" size={16} />All Cash, Bank, and Mobile Money balances</li>
              <li className="flex gap-2"><Trash2 aria-hidden="true" className="mt-0.5 shrink-0 text-status-error" size={16} />Your daily spending and income history</li>
              <li className="flex gap-2"><Trash2 aria-hidden="true" className="mt-0.5 shrink-0 text-status-error" size={16} />All weekly budgets and saved priorities</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-status-success/20 bg-status-success/5 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck aria-hidden="true" className="text-status-success" size={17} />What stays safe:
            </h3>
            <ul className="space-y-2 text-sm leading-5 text-muted">
              <li className="flex gap-2"><CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-status-success" size={16} />Your Largent account and login details</li>
              <li className="flex gap-2"><CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-status-success" size={16} />Your app preferences (like Private view and GHS currency)</li>
            </ul>
          </div>

          <div className="rounded-xl bg-panel p-3">
            <p className="mb-2 text-sm font-medium text-foreground">Want a copy first?</p>
            <Button
              color="primary"
              disabled={exporting || busy}
              onClick={() => void downloadBackup()}
              size="small"
              startIcon={<Download size={16} />}
              sx={{ justifyContent: "flex-start", px: 0, minHeight: 36, textDecoration: "underline", textUnderlineOffset: 3 }}
              variant="text"
            >
              {exporting ? "Preparing CSV backup…" : "Download CSV backup"}
            </Button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground" htmlFor="reset-confirmation">Type RESET below to confirm</label>
            <TextField
              autoComplete="off"
              disabled={busy}
              fullWidth
              id="reset-confirmation"
              onChange={(event) => setConfirmationText(event.target.value)}
              placeholder="RESET"
              size="small"
              value={confirmationText}
              slotProps={{ htmlInput: { "aria-describedby": "reset-confirmation-help", "aria-label": "Type RESET to confirm" } }}
            />
            <p className="text-xs text-muted" id="reset-confirmation-help">This action cannot be undone. Immutable savings-allocation audit history is retained.</p>
          </div>
        </DialogContent>
        <DialogActions className="gap-2 px-5 pb-5 pt-2 sm:px-6 sm:pb-6">
          <Button disabled={busy} onClick={() => setConfirming(null)} sx={{ color: "text.secondary", minHeight: 44, borderRadius: "12px", px: 2.5 }} variant="outlined">Cancel</Button>
          <Button
            color="error"
            disabled={!allResetReady}
            onClick={() => void runReset()}
            sx={{ minHeight: 44, borderRadius: "12px", px: 2.5, "&.Mui-disabled": { color: "action.disabled", backgroundColor: "action.disabledBackground" } }}
            variant="contained"
          >
            {busy ? "Resetting…" : "Reset financial data"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog onClose={() => !busy && setConfirming(null)} open={confirming === "activity"}>
        <DialogTitle>Reset your activity?</DialogTitle>
        <DialogContent className="max-w-md pt-2">
          <p className="text-sm text-muted">All income and spending entries will be cleared and budget progress will return to zero. Your accounts, categories, budgets and priorities will remain untouched.</p>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirming(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => void runReset()} variant="contained">{busy ? "Resetting…" : "Reset activity"}</Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
