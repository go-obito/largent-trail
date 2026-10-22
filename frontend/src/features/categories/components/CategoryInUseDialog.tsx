"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { components } from "@/lib/api/schema";
import { SUPPORTS_CATEGORY_REASSIGN } from "../api";

type CategoryRead = components["schemas"]["CategoryRead"];

type CategoryInUseDialogProps = {
  open: boolean;
  category: CategoryRead;
  replacementCategories: CategoryRead[];
  isArchiving?: boolean;
  isReassigning?: boolean;
  onClose: () => void;
  onArchive: () => void;
  onReassign: (replacementId: string) => void;
};

export function CategoryInUseDialog({
  open,
  category,
  replacementCategories,
  isArchiving = false,
  isReassigning = false,
  onClose,
  onArchive,
  onReassign,
}: CategoryInUseDialogProps) {
  const [replacementId, setReplacementId] = useState("");
  const availableReplacements = replacementCategories.filter(
    (replacement) =>
      replacement.id !== category.id &&
      replacement.kind === category.kind &&
      !replacement.is_archived,
  );

  return (
    <Dialog open={open} onClose={isArchiving || isReassigning ? undefined : onClose}>
      <DialogTitle>Category is in use</DialogTitle>
      <DialogContent className="space-y-4 pt-2">
        <p>
          This category is used by transactions. Archive it instead to keep your
          history.
        </p>
        {SUPPORTS_CATEGORY_REASSIGN && (
          <FormControl fullWidth>
            <InputLabel id="category-replacement-label">
              Replacement category
            </InputLabel>
            <Select
              labelId="category-replacement-label"
              label="Replacement category"
              value={replacementId}
              onChange={(event) => setReplacementId(event.target.value)}
            >
              {availableReplacements.map((replacement) => (
                <MenuItem key={replacement.id} value={replacement.id}>
                  {replacement.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions className="px-6 pb-5">
        <Button
          disabled={isArchiving || isReassigning}
          onClick={onClose}
        >
          Cancel
        </Button>
        {SUPPORTS_CATEGORY_REASSIGN && (
          <Button
            disabled={
              !replacementId ||
              availableReplacements.length === 0 ||
              isArchiving ||
              isReassigning
            }
            onClick={() => onReassign(replacementId)}
          >
            Reassign and delete
          </Button>
        )}
        <Button
          color="primary"
          disabled={isArchiving || isReassigning}
          onClick={onArchive}
          variant="contained"
        >
          Archive instead
        </Button>
      </DialogActions>
    </Dialog>
  );
}
