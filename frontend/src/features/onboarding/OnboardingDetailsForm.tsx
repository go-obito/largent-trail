"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useUpdateMe } from "@/features/me/api";
import type { components } from "@/lib/api/schema";
import { onboardingFieldErrors } from "./errors";

type UserRead = components["schemas"]["UserRead"];

const detailsSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(100, "Use 100 characters or fewer."),
  timezone: z.string().min(1, "Choose a time zone."),
});

type DetailsFormValues = z.infer<typeof detailsSchema>;

function subscribeToDeviceTimeZone() {
  return () => {};
}

function getDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getServerTimeZone() {
  return "";
}

type OnboardingDetailsFormProps = {
  clerkName: string;
  isOnline: boolean;
  user: UserRead;
  onBack: () => void;
  onContinue: () => void;
};

export function OnboardingDetailsForm({
  clerkName,
  isOnline,
  user,
  onBack,
  onContinue,
}: OnboardingDetailsFormProps) {
  const updateMe = useUpdateMe();
  const deviceTimeZone = useSyncExternalStore(
    subscribeToDeviceTimeZone,
    getDeviceTimeZone,
    getServerTimeZone,
  );
  const [submitError, setSubmitError] = useState("");
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
    setError,
    setValue,
  } = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      displayName: user.display_name?.trim() || clerkName,
      timezone: user.timezone,
    },
  });

  const timeZones = useMemo(() => {
    const supported = Intl.supportedValuesOf("timeZone");
    return Array.from(
      new Set([user.timezone, deviceTimeZone, ...supported].filter(Boolean)),
    ).sort((first, second) => first.localeCompare(second));
  }, [deviceTimeZone, user.timezone]);

  useEffect(() => {
    reset({
      displayName: user.display_name?.trim() || clerkName,
      timezone: user.timezone,
    });
  }, [clerkName, reset, user.display_name, user.timezone]);

  async function submit(values: DetailsFormValues) {
    setSubmitError("");
    if (!navigator.onLine) {
      setSubmitError("You're offline. Connect to save your details.");
      return;
    }

    const displayName = values.displayName.trim();
    const changes: components["schemas"]["UserUpdate"] = {};
    if (displayName !== (user.display_name ?? "")) {
      changes.display_name = displayName;
    }
    if (values.timezone !== user.timezone) {
      changes.timezone = values.timezone;
    }

    if (Object.keys(changes).length === 0) {
      onContinue();
      return;
    }

    try {
      await updateMe.mutateAsync(changes);
      onContinue();
    } catch (error) {
      const serverErrors = onboardingFieldErrors(error);
      if (serverErrors.display_name) {
        setError("displayName", {
          type: "server",
          message: serverErrors.display_name,
        });
      }
      if (serverErrors.timezone) {
        setError("timezone", {
          type: "server",
          message: serverErrors.timezone,
        });
      }
      setSubmitError(
        "We couldn't save your details. Check the highlighted fields and try again.",
      );
    }
  }

  return (
    <form className="mt-6 space-y-5" onSubmit={handleSubmit(submit)}>
      {submitError && (
        <Alert aria-live="polite" severity="error">
          {submitError}
        </Alert>
      )}
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            {...field}
            autoComplete="name"
            error={Boolean(errors.displayName)}
            fullWidth
            helperText={errors.displayName?.message}
            label="Display name"
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
        )}
      />
      <div className="space-y-2">
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <TextField
              {...field}
              error={Boolean(errors.timezone)}
              fullWidth
              helperText={
                errors.timezone?.message ??
                "We use this to decide when your day and week start."
              }
              label="Time zone"
              select
            >
              {timeZones.map((timeZone) => (
                <MenuItem key={timeZone} value={timeZone}>
                  {timeZone}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            disabled={!deviceTimeZone}
            onClick={() =>
              setValue("timezone", deviceTimeZone, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            size="small"
            type="button"
            variant="text"
          >
            Use my device time zone
          </Button>
          <span className="text-sm text-muted" role="status">
            {deviceTimeZone
              ? `Detected: ${deviceTimeZone}`
              : "Detecting your device time zone…"}
          </span>
        </div>
      </div>
      {isOnline ? null : (
        <p className="text-sm font-medium text-muted" role="status">
          You&apos;re offline. Connect to save your details, or skip for now.
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button className="min-h-11" onClick={onBack} type="button" variant="outlined">
          Back
        </Button>
        <Button
          className="min-h-11"
          disabled={!isOnline || isSubmitting || updateMe.isPending}
          type="submit"
          variant="contained"
        >
          {isSubmitting || updateMe.isPending ? "Saving…" : "Next"}
        </Button>
      </div>
    </form>
  );
}
