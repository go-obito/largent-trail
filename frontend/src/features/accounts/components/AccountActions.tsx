"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { showToast } from "@/lib/toast";
import { accountErrorMessage } from "../errors";
import { useDeleteAccount, useUpdateAccount } from "../api";

type AccountRead = components["schemas"]["AccountRead"];
type ActionDialog = "archive" | "delete" | "inUse" | null;

type AccountActionsProps = {
  account: AccountRead;
  isOnline: boolean;
  onEdit: () => void;
};

function isAccountInUse(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === "account_in_use"
  );
}

export function AccountActions({
  account,
  isOnline,
  onEdit,
}: AccountActionsProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<ActionDialog>(null);
  const [actionError, setActionError] = useState("");
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const isPending = updateAccount.isPending || deleteAccount.isPending;

  async function setArchived(isArchived: boolean) {
    setActionError("");
    try {
      await updateAccount.mutateAsync({
        id: account.id,
        changes: { is_archived: isArchived },
      });
      setDialog(null);
      setAnchor(null);
      showToast(isArchived ? "Account archived" : "Account unarchived", "success");
    } catch (error) {
      const message = accountErrorMessage(error);
      if (dialog) {
        setActionError(message);
      } else {
        showToast(message, "error");
      }
    }
  }

  async function removeAccount() {
    setActionError("");
    try {
      await deleteAccount.mutateAsync(account.id);
      setDialog(null);
      showToast("Account deleted", "success");
    } catch (error) {
      if (isAccountInUse(error)) {
        setDialog("inUse");
        return;
      }
      setActionError(accountErrorMessage(error));
    }
  }

  function closeDialog() {
    if (!isPending) {
      setDialog(null);
      setActionError("");
    }
  }

  return (
    <>
      <Button
        aria-label={`Actions for ${account.name}`}
        aria-haspopup="menu"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ minHeight: 44, minWidth: 44, flexShrink: 0 }}
      >
        <Ellipsis aria-hidden="true" size={20} />
      </Button>
      <Menu
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        open={Boolean(anchor)}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onEdit();
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          disabled={!isOnline || isPending}
          onClick={() => {
            setAnchor(null);
            if (account.is_archived) {
              void setArchived(false);
            } else {
              setActionError("");
              setDialog("archive");
            }
          }}
        >
          {account.is_archived ? "Unarchive" : "Archive"}
        </MenuItem>
        <MenuItem
          disabled={!isOnline || isPending}
          onClick={() => {
            setAnchor(null);
            setActionError("");
            setDialog("delete");
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      <Dialog onClose={closeDialog} open={dialog === "archive"}>
        <DialogTitle>Archive account?</DialogTitle>
        <DialogContent className="space-y-3 pt-2">
          <p className="text-sm text-muted">
            Archived accounts can&apos;t receive new transactions. Your history
            is kept.
          </p>
          {!isOnline && (
            <p className="text-sm font-medium text-muted" role="status">
              You&apos;re offline. Connect to archive this account.
            </p>
          )}
          {actionError && (
            <p aria-live="polite" className="text-sm text-alert" role="alert">
              {actionError}
            </p>
          )}
        </DialogContent>
        <DialogActions className="px-6 pb-5">
          <Button disabled={isPending} onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            disabled={!isOnline || isPending}
            onClick={() => void setArchived(true)}
            variant="contained"
          >
            {isPending ? "Archiving…" : "Archive"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog onClose={closeDialog} open={dialog === "delete"}>
        <DialogTitle>Delete account?</DialogTitle>
        <DialogContent className="space-y-3 pt-2">
          <p className="text-sm text-muted">
            This will permanently delete {account.name}.
          </p>
          {!isOnline && (
            <p className="text-sm font-medium text-muted" role="status">
              You&apos;re offline. Connect to delete this account.
            </p>
          )}
          {actionError && (
            <p aria-live="polite" className="text-sm text-alert" role="alert">
              {actionError}
            </p>
          )}
        </DialogContent>
        <DialogActions className="px-6 pb-5">
          <Button disabled={isPending} onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            color="error"
            disabled={!isOnline || isPending}
            onClick={() => void removeAccount()}
            variant="contained"
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog onClose={closeDialog} open={dialog === "inUse"}>
        <DialogTitle>This account is in use</DialogTitle>
        <DialogContent className="space-y-3 pt-2">
          <p className="text-sm text-muted">
            This account has transactions. Archive it instead to keep your
            history.
          </p>
          {!isOnline && (
            <p className="text-sm font-medium text-muted" role="status">
              You&apos;re offline. Connect to archive this account.
            </p>
          )}
          {actionError && (
            <p aria-live="polite" className="text-sm text-alert" role="alert">
              {actionError}
            </p>
          )}
        </DialogContent>
        <DialogActions className="px-6 pb-5">
          <Button disabled={isPending} onClick={closeDialog}>
            Cancel
          </Button>
          <Button
            disabled={!isOnline || isPending}
            onClick={() => void setArchived(true)}
            variant="contained"
          >
            {isPending ? "Archiving…" : "Archive"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
