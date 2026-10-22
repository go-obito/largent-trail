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
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useCreateNeed, useUpdateNeed } from "@/features/needs/api";
import { needErrorMessage, needFieldErrors } from "@/features/needs/errors";
import { isSafeHttpUrl } from "@/features/needs/helpers";
import type { components } from "@/lib/api/schema";
import { parseGhsInput } from "@/lib/money";
import { showToast } from "@/lib/toast";
import { uuidv7 } from "@/lib/uuid";

type NeedRead = components["schemas"]["NeedRead"];
const needFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name for this need.").max(100),
  target: z
    .string()
    .trim()
    .min(1, "Enter a target amount.")
    .refine((value) => {
      const amount = parseGhsInput(value);
      return amount !== null && amount > 0;
    }, "Enter an amount greater than zero, with up to two decimal places."),
  priority: z.enum(["high", "medium", "low"]),
  note: z.string().trim().max(280, "Keep the note to 280 characters or fewer."),
  source_url: z
    .string()
    .trim()
    .max(2048, "The link is too long.")
    .refine((value) => !value || isSafeHttpUrl(value), "Enter a valid http or https link."),
});

type NeedFormValues = z.infer<typeof needFormSchema>;

function minorToInput(amountMinor: number) {
  const whole = Math.floor(amountMinor / 100).toString();
  const fraction = (amountMinor % 100).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

const fieldMap: Record<string, keyof NeedFormValues> = {
  name: "name",
  target_minor: "target",
  priority: "priority",
  note: "note",
  source_url: "source_url",
};

export function NeedFormDialog({
  isOnline,
  need,
  onClose,
  onSaved,
}: {
  isOnline: boolean;
  need: NeedRead | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = need !== null;
  const createNeed = useCreateNeed();
  const updateNeed = useUpdateNeed();
  const [createId] = useState(() => (isEditing ? "" : uuidv7()));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<NeedFormValues>({
    resolver: zodResolver(needFormSchema),
    defaultValues: {
      name: need?.name ?? "",
      target: need ? minorToInput(need.target_minor) : "",
      priority: need?.priority ?? "medium",
      note: need?.note ?? "",
      source_url: need?.source_url ?? "",
    },
  });
  const isPending = createNeed.isPending || updateNeed.isPending;

  async function submit(values: NeedFormValues) {
    setSubmitError(null);
    const targetMinor = parseGhsInput(values.target);
    if (targetMinor === null || targetMinor <= 0) {
      form.setError("target", {
        type: "validate",
        message: "Enter an amount greater than zero, with up to two decimal places.",
      });
      return;
    }

    try {
      if (need) {
        const changes: components["schemas"]["NeedUpdate"] = {};
        if (values.name.trim() !== need.name) {
          changes.name = values.name.trim();
        }
        if (targetMinor !== need.target_minor) {
          changes.target_minor = targetMinor;
        }
        if (values.priority !== need.priority) {
          changes.priority = values.priority;
        }
        const note = values.note.trim() || null;
        if (note !== need.note) {
          changes.note = note;
        }
        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }

        await updateNeed.mutateAsync({ id: need.id, changes });
        showToast("Need updated", "success");
      } else {
        await createNeed.mutateAsync({
          id: createId,
          name: values.name.trim(),
          target_minor: targetMinor,
          priority: values.priority,
          note: values.note.trim() || null,
          source_url: values.source_url.trim() || null,
        });
        showToast("Need added", "success");
      }
      onSaved();
    } catch (error) {
      setSubmitError(needErrorMessage(error));
      for (const [field, message] of Object.entries(needFieldErrors(error))) {
        const formField = fieldMap[field];
        if (formField) {
          form.setError(formField, { type: "server", message });
        }
      }
    }
  }

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      onClose={() => !isPending && onClose()}
      open
      slotProps={{
        paper: {
          sx: { borderRadius: "var(--radius-card)", maxWidth: 560 },
        },
      }}
    >
      <DialogTitle>{isEditing ? "Edit need" : "Add a need"}</DialogTitle>
      <form noValidate onSubmit={form.handleSubmit(submit)}>
        <DialogContent className="space-y-4 pt-2">
          {submitError && (
            <Alert aria-live="polite" severity="error">
              {submitError}
            </Alert>
          )}
          {!isOnline && (
            <Alert aria-live="polite" severity="info">
              You&apos;re offline. Changes need a connection.
            </Alert>
          )}
          <TextField
            {...form.register("name")}
            autoFocus
            error={Boolean(form.formState.errors.name)}
            fullWidth
            helperText={form.formState.errors.name?.message}
            label="Need name"
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <TextField
            {...form.register("target")}
            error={Boolean(form.formState.errors.target)}
            fullWidth
            helperText={form.formState.errors.target?.message}
            inputMode="decimal"
            label="Target amount"
            placeholder="0.00"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">₵</InputAdornment>
                ),
              },
              htmlInput: { inputMode: "decimal" },
            }}
          />
          <FormControl
            error={Boolean(form.formState.errors.priority)}
            fullWidth
          >
            <InputLabel id="need-priority-label">Priority</InputLabel>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <Select
                  {...field}
                  label="Priority"
                  labelId="need-priority-label"
                  sx={{ minHeight: 44 }}
                >
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              )}
            />
            <FormHelperText aria-live="polite">
              {form.formState.errors.priority?.message}
            </FormHelperText>
          </FormControl>
          <TextField
            {...form.register("note")}
            error={Boolean(form.formState.errors.note)}
            fullWidth
            helperText={form.formState.errors.note?.message ?? "Optional"}
            label="Note"
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 280 } }}
          />
          {!isEditing && (
            <TextField
              {...form.register("source_url")}
              error={Boolean(form.formState.errors.source_url)}
              fullWidth
              helperText={form.formState.errors.source_url?.message ?? "Optional product or reference link"}
              label="Source link"
              placeholder="https://example.com/item"
              slotProps={{ htmlInput: { maxLength: 2048, inputMode: "url" } }}
            />
          )}
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
            sx={{ minHeight: 44 }}
            type="submit"
            variant="contained"
          >
            {isPending ? "Saving…" : isEditing ? "Save changes" : "Add need"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
