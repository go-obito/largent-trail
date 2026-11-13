"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useAuth } from "@clerk/nextjs";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { clearPersistedQueryCache } from "@/app/providers";

type ResetKind = "activity" | "all" | null;

export function DataManagementSection() {
  const { getToken, userId } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [confirming, setConfirming] = useState<ResetKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const runReset = async () => {
    if (!confirming || busy || !userId) return;
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
        localStorage.removeItem(`largent-onboarding:${userId}`);
        await clearPersistedQueryCache(userId);
        queryClient.clear();
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
            <p className="mt-1 text-sm text-muted">Clear transactions, account balances, budgets, categories, accounts and priorities. Your login and profile stay intact.</p>
            <Button className="mt-3" color="error" onClick={() => { setError(null); setConfirming("all"); }} sx={{ minHeight: 40 }} variant="outlined">Clear all financial data</Button>
          </div>
        </div>
      </div>
      {notice && <p aria-live="polite" className="text-sm text-status-success" role="status">{notice}</p>}
      {error && <p aria-live="assertive" className="text-sm text-status-error" role="alert">{error}</p>}
      <Dialog onClose={() => !busy && setConfirming(null)} open={Boolean(confirming)}>
        <DialogTitle className="flex items-center gap-2">
          {confirming === "all" && <AlertTriangle aria-hidden="true" className="text-status-error" size={20} />}
          {confirming === "activity" ? "Reset your activity?" : "Clear all financial data?"}
        </DialogTitle>
        <DialogContent className="max-w-md pt-2">
          <p className="text-sm text-muted">
            {confirming === "activity"
              ? "All income and spending entries will be cleared and budget progress will return to zero. Your accounts, categories, budgets and priorities will remain untouched."
              : "This will erase all transactions, account balances, budgets, categories, accounts and priorities, then return you to onboarding. Your login credentials and profile will remain intact. This cannot be undone."}
          </p>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirming(null)}>Cancel</Button>
          <Button color={confirming === "all" ? "error" : "primary"} disabled={busy} onClick={() => void runReset()} variant="contained">
            {busy ? "Resetting…" : confirming === "activity" ? "Reset activity" : "Clear everything"}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
