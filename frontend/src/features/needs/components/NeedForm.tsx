"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@clerk/nextjs";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clipboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { useNeed, useCreateNeed, useUpdateNeed } from "@/features/needs/api";
import { needErrorMessage, needFieldErrors } from "@/features/needs/errors";
import { isSafeHttpUrl } from "@/features/needs/helpers";
import { ApiError } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { parseGhsInput } from "@/lib/money";
import { showToast } from "@/lib/toast";
import { uuidv7 } from "@/lib/uuid";

type NeedRead = components["schemas"]["NeedRead"];
type NeedPriority = components["schemas"]["NeedPriority"];

const needFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a name for this need.").max(100, "Keep the name to 100 characters or fewer."),
  target: z
    .string()
    .trim()
    .min(1, "Enter a target amount.")
    .refine((value) => {
      const amount = parseGhsInput(value);
      return amount !== null && amount > 0;
    }, "Enter an amount greater than zero, with up to two decimal places. The maximum is ₵10,000,000,000.00."),
  priority: z.enum(["high", "medium", "low"]),
  note: z.string().max(280, "Keep the note to 280 characters or fewer."),
  source_url: z
    .string()
    .trim()
    .max(2048, "The link is too long.")
    .refine(
      (value) => !value || isSafeHttpUrl(value),
      "Enter a valid http or https link.",
    ),
});

type NeedFormValues = z.infer<typeof needFormSchema>;

const priorities: NeedPriority[] = ["high", "medium", "low"];
const fieldMap: Record<string, keyof NeedFormValues> = {
  name: "name",
  target_minor: "target",
  priority: "priority",
  note: "note",
  source_url: "source_url",
};

function minorToInput(amountMinor: number) {
  const whole = Math.floor(amountMinor / 100).toString();
  const fraction = (amountMinor % 100).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function sharedUrl(url?: string, text?: string) {
  const explicitUrl = url?.trim();
  if (explicitUrl && isSafeHttpUrl(explicitUrl)) {
    return explicitUrl;
  }

  const textUrl = text
    ?.match(/https?:\/\/[^\s<>"']+/i)?.[0]
    ?.replace(/[),.!?;:]+$/, "");
  return textUrl && isSafeHttpUrl(textUrl) ? textUrl : "";
}

export function NeedForm({
  mode,
  needId = "",
  sharedTitle,
  sharedLink,
  sharedText,
}: {
  mode: "create" | "edit";
  needId?: string;
  sharedTitle?: string | string[];
  sharedLink?: string | string[];
  sharedText?: string | string[];
}) {
  const isEditing = mode === "edit";
  const needQuery = useNeed(isEditing ? needId : "");

  if (isEditing && needQuery.isPending) {
    return <LoadingSkeleton label="Loading need" rows={3} />;
  }
  if (isEditing && needQuery.isError && needQuery.error instanceof ApiError && needQuery.error.status === 404) {
    return (
      <div className="mx-auto max-w-[560px] space-y-4">
        <EmptyState
          title="Need not found"
          description="This need may have been deleted or you may not have access to it."
        />
        <Button component={Link} href="/needs" startIcon={<ArrowLeft aria-hidden="true" size={18} />} variant="outlined">
          Back to needs
        </Button>
      </div>
    );
  }
  if (isEditing && needQuery.isError) {
    return (
      <ErrorState
        description="We couldn't load this need. Check your connection and try again."
        onRetry={() => void needQuery.refetch()}
        title="Need couldn't be loaded"
      />
    );
  }
  if (isEditing && !needQuery.data) {
    return <LoadingSkeleton label="Preparing need form" rows={3} />;
  }

  return (
    <NeedFormEditor
      key={isEditing ? needQuery.data?.id : "new-need"}
      mode={mode}
      need={needQuery.data}
      sharedLink={sharedUrl(first(sharedLink), first(sharedText))}
      sharedTitle={first(sharedTitle)}
    />
  );
}

function NeedFormEditor({
  mode,
  need,
  sharedTitle,
  sharedLink,
}: {
  mode: "create" | "edit";
  need?: NeedRead;
  sharedTitle?: string;
  sharedLink: string;
}) {
  const router = useRouter();
  const { getToken } = useAuth();
  const isEditing = mode === "edit";
  const createNeed = useCreateNeed();
  const updateNeed = useUpdateNeed();
  // Keep the same ID when a request fails so retries remain idempotent, but
  // rotate it after a successful create in case this form instance is reused.
  const createId = useRef(isEditing ? "" : uuidv7());
  const [isOnline, setIsOnline] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linkMessageSeverity, setLinkMessageSeverity] = useState<
    "success" | "info" | "warning" | "error"
  >("info");
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const form = useForm<NeedFormValues>({
    resolver: zodResolver(needFormSchema),
    defaultValues: {
      name: need?.name ?? sharedTitle?.slice(0, 100) ?? "",
      target: need ? minorToInput(need.target_minor) : "",
      priority: need?.priority ?? "medium",
      note: need?.note ?? "",
      source_url: need?.source_url ?? sharedLink,
    },
  });
  const note = useWatch({ control: form.control, name: "note" }) ?? "";
  const isPending = createNeed.isPending || updateNeed.isPending;

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  async function fetchProductDetails() {
    const url = form.getValues("source_url").trim();
    setLinkMessage(null);
    if (!isSafeHttpUrl(url)) {
      form.setError("source_url", { type: "validate", message: "Enter a valid http or https product link." });
      return;
    }
    if (!navigator.onLine) {
      setLinkMessageSeverity("warning");
      setLinkMessage("Connect to the internet before fetching product details.");
      return;
    }

    setIsFetchingLink(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Your session could not be verified. Sign in again and retry.");
      }
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!baseUrl) {
        throw new Error("Product lookup is temporarily unavailable.");
      }
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/needs/link-preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ url }),
      });
      const result = await response.json().catch(() => null) as {
        name?: string | null;
        target_minor?: number | null;
        price_minor?: number | null;
        price_currency?: string | null;
        detail?: string;
        code?: string;
      } | null;

      if (!response.ok) {
        const messages: Record<string, string> = {
          site_blocked: "This website blocks automatic previews. Enter the product details manually.",
          fetch_timeout: "The product page took too long to respond. Try again.",
          url_not_allowed: "This product link cannot be fetched safely.",
          not_a_product_page: "This link doesn't appear to be a product page.",
          page_too_large: "This product page is too large to preview.",
        };
        throw new Error((result?.code && messages[result.code]) || result?.detail || "We couldn't fetch this product. Try again or enter the details manually.");
      }

      let populated = false;
      if (result?.name && !form.getFieldState("name").isDirty) {
        form.setValue("name", result.name.slice(0, 100), { shouldDirty: true, shouldValidate: true });
        populated = true;
      }
      if (typeof result?.target_minor === "number" && result.target_minor > 0 && !form.getFieldState("target").isDirty) {
        form.setValue("target", minorToInput(result.target_minor), { shouldDirty: true, shouldValidate: true });
        populated = true;
      }

      if (!result?.name && typeof result?.price_minor !== "number") {
        setLinkMessageSeverity("warning");
        setLinkMessage("The page opened, but it didn't expose product details. You can still enter them manually.");
      } else if (result.price_currency && result.price_currency !== "GHS") {
        setLinkMessageSeverity("info");
        setLinkMessage(`Product details found. The price is in ${result.price_currency}; enter the Ghana cedi equivalent yourself.`);
      } else if (populated) {
        setLinkMessageSeverity("success");
        setLinkMessage("Product details fetched. Review the suggested name and price before saving.");
      } else {
        setLinkMessageSeverity("info");
        setLinkMessage("Product details found, but your edited fields were left unchanged.");
      }
    } catch (error) {
      setLinkMessageSeverity("error");
      setLinkMessage(error instanceof Error ? error.message : "We couldn't fetch this product. Enter the details manually.");
    } finally {
      setIsFetchingLink(false);
    }
  }

  async function pasteLink() {
    setLinkMessage(null);
    try {
      const pasted = await navigator.clipboard.readText();
      form.setValue("source_url", pasted.trim(), {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch {
      setLinkMessage("Clipboard access wasn't allowed. Paste the link into the field instead.");
    }
  }

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
        const priorityChanged = values.priority !== need.priority;
        if (priorityChanged) {
          changes.priority = values.priority;
        }
        const noteValue = values.note.trim() || null;
        if (noteValue !== need.note) {
          changes.note = noteValue;
        }
        if (Object.keys(changes).length > 0) {
          await updateNeed.mutateAsync({ id: need.id, changes });
          showToast(
            priorityChanged ? "Moved to match its priority" : "Need updated",
            "success",
          );
        }
      } else {
        await createNeed.mutateAsync({
          id: createId.current,
          name: values.name.trim(),
          target_minor: targetMinor,
          priority: values.priority,
          note: values.note.trim() || null,
          source_url: values.source_url.trim() || null,
        });
        showToast("Need added", "success");
        createId.current = uuidv7();
      }
      router.push("/needs");
    } catch (error) {
      setSubmitError(needErrorMessage(error) ?? "This need could not be saved.");
      for (const [field, message] of Object.entries(needFieldErrors(error))) {
        const formField = fieldMap[field];
        if (formField) {
          form.setError(formField, { type: "server", message });
        }
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-[560px] pb-28 md:pb-4">
      <header className="mb-5">
        <Button
          component={Link}
          href="/needs"
          startIcon={<ArrowLeft aria-hidden="true" size={18} />}
          sx={{ mb: 2, minHeight: 44 }}
        >
          Needs
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isEditing ? "Edit need" : "Add a need"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isEditing ? "Update your target and how you prioritize it." : "Plan what you need and save toward it."}
        </p>
      </header>

      <form
        className="card-surface space-y-5 p-5 sm:p-6"
        noValidate
        onSubmit={form.handleSubmit(submit)}
      >
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
          label="Name"
          slotProps={{
            formHelperText: { "aria-live": "polite" },
            htmlInput: { maxLength: 100 },
          }}
        />
        <TextField
          {...form.register("target")}
          error={Boolean(form.formState.errors.target)}
          fullWidth
          helperText={form.formState.errors.target?.message ?? "Enter the target in Ghana cedis."}
          inputMode="decimal"
          label="Target price"
          placeholder="0.00"
          slotProps={{
            formHelperText: { "aria-live": "polite" },
            input: {
              startAdornment: <InputAdornment position="start">₵</InputAdornment>,
            },
            htmlInput: { inputMode: "decimal" },
          }}
        />
        <FormControl error={Boolean(form.formState.errors.priority)}>
          <span className="mb-2 text-sm font-medium text-foreground">Priority</span>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <ToggleButtonGroup
                aria-label="Priority"
                exclusive
                fullWidth
                onChange={(_event, value: NeedPriority | null) => {
                  if (value && priorities.includes(value)) {
                    field.onChange(value);
                  }
                }}
                value={field.value}
              >
                {priorities.map((priority) => (
                  <ToggleButton key={priority} sx={{ minHeight: 44, textTransform: "capitalize" }} value={priority}>
                    {priority}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
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
          slotProps={{
            formHelperText: { "aria-live": "polite" },
            htmlInput: { maxLength: 280 },
          }}
        />
        <p aria-live="polite" className="-mt-4 text-right text-xs text-muted">
          {note.length}/280
        </p>
        {!isEditing && (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <TextField
                {...form.register("source_url")}
                className="min-w-0 flex-1"
                error={Boolean(form.formState.errors.source_url)}
                helperText={form.formState.errors.source_url?.message ?? "Optional product link"}
                label="Product link"
                placeholder="https://example.com/item"
                slotProps={{
                  formHelperText: { "aria-live": "polite" },
                  htmlInput: { maxLength: 2048, inputMode: "url" },
                }}
              />
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  disabled={!isOnline || isFetchingLink}
                  onClick={() => void fetchProductDetails()}
                  sx={{ minHeight: 44 }}
                  type="button"
                >
                  {isFetchingLink ? "Fetching…" : "Fetch details"}
                </Button>
                <Button
                  onClick={() => void pasteLink()}
                  startIcon={<Clipboard aria-hidden="true" size={16} />}
                  sx={{ minHeight: 44 }}
                  type="button"
                >
                  Paste
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted">
              Fetch product information from a supported public product page. Some marketplaces block automatic previews.
            </p>
            {linkMessage && (
              <Alert aria-live="polite" severity={linkMessageSeverity}>
                {linkMessage}
              </Alert>
            )}
          </div>
        )}
        <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-outline bg-surface px-5 py-4 sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0">
          <Button
            component={Link}
            disabled={isPending}
            href="/needs"
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
        </div>
      </form>
    </div>
  );
}
