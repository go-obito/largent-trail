"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
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
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const [kind, setKind] = useState<"allocate" | "release">("allocate");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [id] = useState(() => uuidv7());
  const parsedAmount = parseGhsInput(amount);
  const amountError =
    amount.length > 0 && (parsedAmount === null || parsedAmount <= 0)
      ? "Enter an amount greater than zero, with up to two decimal places."
      : null;
  const availableMinor = summary?.unallocated_minor;
  const remainingMinor = Math.max(0, need.remaining_minor);
  const allocatedMinor = Math.max(0, need.allocated_minor);
  const adjustmentError =
    parsedAmount === null || parsedAmount <= 0
      ? amountError ?? "Enter an amount greater than zero."
      : kind === "allocate" && parsedAmount > remainingMinor
        ? "That's more than this need still requires."
        : kind === "allocate" &&
            availableMinor !== undefined &&
            parsedAmount > availableMinor
          ? "That's more than your unallocated savings."
          : kind === "release" && parsedAmount > allocatedMinor
            ? "That's more than is set aside for this need."
            : null;
  const summaryUnavailable = kind === "allocate" && availableMinor === undefined;

  function setAmountFromMinor(minor: number) {
    setAmount(`${Math.floor(minor / 100)}.${(minor % 100).toString().padStart(2, "0")}`);
    setMessage(null);
  }

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
        kind === "allocate"
          ? `${formatGhs(parsedAmount)} set aside for ${need.name}`
          : `${formatGhs(parsedAmount)} taken back`,
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
      fullScreen={isPhone}
      maxWidth="xs"
      onClose={() => !allocate.isPending && onClose()}
      open
      slotProps={{
        paper: {
          sx: {
            borderRadius: isPhone ? 0 : "var(--radius-card)",
            maxWidth: isPhone ? "none" : 440,
          },
        },
      }}
    >
      <DialogTitle>Adjust money set aside</DialogTitle>
      <form noValidate onSubmit={submit}>
        <DialogContent className="space-y-4 pt-2">
          <p className="font-semibold text-foreground">{need.name}</p>
          <p className="text-sm text-muted">
            {kind === "allocate"
              ? `Unallocated savings ${availableMinor === undefined ? "unavailable" : formatGhs(availableMinor)} · this need still needs ${formatGhs(remainingMinor)}.`
              : `${formatGhs(allocatedMinor)} is currently set aside for this need.`}
          </p>
          {summaryUnavailable && (
            <Alert severity="warning">
              The savings summary isn&apos;t available, so setting money aside is disabled.
            </Alert>
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
          <ToggleButtonGroup
            aria-label="Money adjustment"
            onChange={(_event, value: "allocate" | "release" | null) => {
              if (value === "allocate" || value === "release") {
                setKind(value);
                setMessage(null);
              }
            }}
            exclusive
            value={kind}
          >
            <ToggleButton sx={{ minHeight: 44 }} value="allocate">
              Set aside
            </ToggleButton>
            <ToggleButton sx={{ minHeight: 44 }} value="release">
              Take back
            </ToggleButton>
          </ToggleButtonGroup>
          <TextField
            autoFocus
            error={Boolean(amountError)}
            fullWidth
            helperText={adjustmentError ?? "Enter an amount in Ghana cedis."}
            inputMode="decimal"
            label="Amount"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            slotProps={{
              formHelperText: { "aria-live": "polite" },
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
          <div aria-label="Amount shortcuts" className="flex flex-wrap gap-2" role="group">
            {kind === "allocate" ? (
              <>
                <Button
                  disabled={!isOnline || remainingMinor <= 0}
                  onClick={() => setAmountFromMinor(remainingMinor)}
                  size="small"
                  type="button"
                  variant="outlined"
                >
                  Remaining
                </Button>
                <Button
                  disabled={!isOnline || availableMinor === undefined || availableMinor <= 0}
                  onClick={() => availableMinor !== undefined && setAmountFromMinor(availableMinor)}
                  size="small"
                  type="button"
                  variant="outlined"
                >
                  All available
                </Button>
              </>
            ) : (
              <Button
                disabled={!isOnline || allocatedMinor <= 0}
                onClick={() => setAmountFromMinor(allocatedMinor)}
                size="small"
                type="button"
                variant="outlined"
              >
                All
              </Button>
            )}
          </div>
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
              summaryUnavailable ||
              adjustmentError !== null
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
