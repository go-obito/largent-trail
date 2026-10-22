"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { z } from "zod";
import { useAllocate } from "@/features/needs/api";
import { needErrorMessage } from "@/features/needs/errors";
import type { components } from "@/lib/api/schema";
import { formatGhs, parseGhsInput } from "@/lib/money";
import { showToast } from "@/lib/toast";
import { uuidv7 } from "@/lib/uuid";

type NeedRead = components["schemas"]["NeedRead"];
type NeedSummary = components["schemas"]["NeedSummary"];

const amountSchema = z.string().trim().min(1, "Enter an amount.").refine(
  (value) => {
    const amount = parseGhsInput(value);
    return amount !== null && amount > 0;
  },
  "Enter an amount greater than zero, with up to two decimal places.",
);

export function AllocationDialog({
  isOnline,
  need,
  summary,
  onClose,
}: {
  isOnline: boolean;
  need: NeedRead;
  summary?: NeedSummary;
  onClose: () => void;
}) {
  const allocate = useAllocate();
  const [kind, setKind] = useState<"allocate" | "release">("allocate");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [id] = useState(() => uuidv7());
  const parsedAmount = parseGhsInput(amount);
  const amountError =
    amount.length > 0 && (parsedAmount === null || parsedAmount <= 0)
      ? "Enter an amount greater than zero, with up to two decimal places."
      : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const validAmount = amountSchema.safeParse(amount);
    if (!validAmount.success || parsedAmount === null || parsedAmount <= 0) {
      setMessage(
        validAmount.success
          ? "Enter an amount greater than zero, with up to two decimal places."
          : validAmount.error.issues[0]?.message ?? "Enter an amount.",
      );
      return;
    }

    try {
      await allocate.mutateAsync({
        needId: need.id,
        id,
        kind,
        amount_minor: parsedAmount,
      });
      showToast(
        kind === "allocate" ? "Money set aside" : "Money taken back",
        "success",
      );
      onClose();
    } catch (error) {
      setMessage(needErrorMessage(error));
    }
  }

  return (
    <Dialog
      fullWidth
      maxWidth="xs"
      onClose={() => !allocate.isPending && onClose()}
      open
      slotProps={{
        paper: {
          sx: { borderRadius: "var(--radius-card)", maxWidth: 440 },
        },
      }}
    >
      <DialogTitle>Adjust money set aside</DialogTitle>
      <form noValidate onSubmit={submit}>
        <DialogContent className="space-y-4 pt-2">
          <p className="font-semibold text-foreground">{need.name}</p>
          {summary && (
            <p className="text-sm text-muted">
              Unallocated savings {formatGhs(summary.unallocated_minor)} ·{" "}
              {formatGhs(need.allocated_minor)} set aside
            </p>
          )}
          {!isOnline && (
            <Alert severity="info">
              You&apos;re offline. Changes need a connection.
            </Alert>
          )}
          {message && (
            <Alert aria-live="polite" severity="error">
              {message}
            </Alert>
          )}
          <RadioGroup
            aria-label="Money adjustment"
            onChange={(_event, value) =>
              setKind(value as "allocate" | "release")
            }
            row
            value={kind}
          >
            <FormControlLabel
              control={<Radio />}
              label="Set aside"
              value="allocate"
            />
            <FormControlLabel
              control={<Radio />}
              label="Take back"
              value="release"
            />
          </RadioGroup>
          <TextField
            autoFocus
            error={Boolean(amountError)}
            fullWidth
            helperText={amountError ?? "Enter an amount in Ghana cedis."}
            inputMode="decimal"
            label="Amount"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            slotProps={{
              input: {
                startAdornment: (
                  <span className="mr-2 text-muted" aria-hidden="true">
                    ₵
                  </span>
                ),
              },
              htmlInput: { inputMode: "decimal" },
            }}
            value={amount}
          />
        </DialogContent>
        <DialogActions className="px-6 pb-5">
          <Button
            disabled={allocate.isPending}
            onClick={onClose}
            sx={{ minHeight: 44 }}
          >
            Cancel
          </Button>
          <Button
            disabled={
              !isOnline ||
              allocate.isPending ||
              parsedAmount === null ||
              parsedAmount <= 0
            }
            sx={{ minHeight: 44 }}
            type="submit"
            variant="contained"
          >
            {allocate.isPending
              ? "Saving…"
              : kind === "allocate"
                ? "Set aside"
                : "Take back"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
