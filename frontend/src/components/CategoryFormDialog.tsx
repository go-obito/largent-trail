"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Shapes, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CategoryBadge } from "@/components/CategoryBadge";
import {
  useCreateCategory,
  useUpdateCategory,
} from "@/features/categories/api";
import {
  categoryErrorMessage,
  categoryFieldErrors,
} from "@/features/categories/errors";
import { categoryIcons } from "@/features/categories/icons";
import { ApiError } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { showToast } from "@/lib/toast";
import { uuidv7 } from "@/lib/uuid";

type CategoryKind = components["schemas"]["CategoryKind"];
type CategoryRead = components["schemas"]["CategoryRead"];

type CategoryFormDialogProps = {
  category?: CategoryRead | null;
  initialKind?: CategoryKind;
  onClose: () => void;
  onCreated?: (category: CategoryRead) => void;
  open: boolean;
};

export function CategoryFormDialog({
  category = null,
  initialKind = "expense",
  onClose,
  onCreated,
  open,
}: CategoryFormDialogProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [categoryId, setCategoryId] = useState(() => uuidv7());
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<CategoryKind>(
    category?.kind ?? initialKind,
  );
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null);
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [nameError, setNameError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const isPending = createCategory.isPending || updateCategory.isPending;

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 60) {
      setNameError(
        trimmedName.length > 60
          ? "Use 60 characters or fewer."
          : "Enter a category name.",
      );
      return;
    }

    setNameError("");
    setSubmitError("");
    try {
      if (category) {
        const changes: { name?: string; icon?: string | null } = {};
        if (trimmedName !== category.name) changes.name = trimmedName;
        if (icon !== category.icon) changes.icon = icon;
        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }
        await updateCategory.mutateAsync({ id: category.id, changes });
        showToast("Category updated", "success");
      } else {
        const created = await createCategory.mutateAsync({
          id: categoryId,
          kind,
          name: trimmedName,
          icon,
        });
        setCategoryId(uuidv7());
        onCreated?.(created);
        showToast("Category added", "success");
      }
      onClose();
    } catch (error) {
      const fieldErrors = categoryFieldErrors(error);
      if (fieldErrors.name) setNameError(fieldErrors.name);
      if (error instanceof ApiError && error.code === "duplicate_name") {
        setNameError(categoryErrorMessage(error, kind));
      }
      setSubmitError(categoryErrorMessage(error, kind));
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
        <span>{category ? "Edit category" : "Add category"}</span>
        <IconButton
          aria-label="Close category form"
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
            You&apos;re offline. Connect to save category changes.
          </Alert>
        )}
        {!category ? (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Type</p>
            <ToggleButtonGroup
              aria-label="Category type"
              exclusive
              fullWidth
              onChange={(_, value: CategoryKind | null) => {
                if (value) setKind(value);
              }}
              value={kind}
            >
              <ToggleButton sx={{ minHeight: 44, textTransform: "capitalize" }} value="expense">
                Expense
              </ToggleButton>
              <ToggleButton sx={{ minHeight: 44, textTransform: "capitalize" }} value="income">
                Income
              </ToggleButton>
            </ToggleButtonGroup>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-foreground">Type</p>
            <p className="mt-1 capitalize text-foreground">{category.kind}</p>
            <p className="mt-1 text-sm text-muted">
              The type can&apos;t be changed after creation.
            </p>
          </div>
        )}

        <form
          className="space-y-5"
          id="category-form"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex items-start gap-3">
            <TextField
              autoFocus
              error={Boolean(nameError)}
              fullWidth
              helperText={
                <span aria-live="polite">
                  {nameError || "Use 1 to 60 characters."}
                </span>
              }
              label="Name"
              onChange={(event) => {
                setName(event.target.value);
                setNameError("");
              }}
              slotProps={{ htmlInput: { maxLength: 60 } }}
              value={name}
            />
            <div className="pt-2" aria-live="polite" aria-label="Category preview">
              <CategoryBadge icon={icon} name={name.trim() || "Category"} />
            </div>
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-medium text-foreground">
              Icon
            </legend>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
              <button
                aria-label="Default icon"
                aria-pressed={icon === null}
                className={`col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-outline bg-panel px-2 text-sm text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  icon === null ? "ring-2 ring-primary ring-offset-2" : ""
                }`}
                onClick={() => setIcon(null)}
                type="button"
              >
                <Shapes aria-hidden="true" size={20} />
                Default
              </button>
              {(Object.keys(categoryIcons) as (keyof typeof categoryIcons)[]).map((key) => {
                return (
                  <button
                    aria-label={key.replaceAll("-", " ")}
                    aria-pressed={icon === key}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border border-outline bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                      icon === key ? "ring-2 ring-primary ring-offset-2" : ""
                    }`}
                    key={key}
                    onClick={() => setIcon(key)}
                    type="button"
                  >
                    <CategoryBadge
                      icon={key}
                      name={key.replaceAll("-", " ")}
                      size={36}
                    />
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted">
              Choose an icon, or use Default to clear it.
            </p>
          </fieldset>
        </form>
      </DialogContent>
      <DialogActions className="sticky bottom-0 z-10 border-t border-outline bg-surface px-6 py-4 md:static md:border-0">
        <Button disabled={isPending} onClick={onClose} sx={{ minHeight: 44 }}>
          Cancel
        </Button>
        <Button
          disabled={isPending || !isOnline}
          form="category-form"
          sx={{ minHeight: 44 }}
          type="submit"
          variant="contained"
        >
          {isPending
            ? category
              ? "Saving…"
              : "Adding…"
            : category
              ? "Save changes"
              : "Add category"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
