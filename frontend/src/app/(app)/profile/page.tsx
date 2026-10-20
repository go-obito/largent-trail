"use client";

import Button from "@mui/material/Button";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/features/me/api";
import { clearPersistedQueryCache } from "@/app/providers";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";

export default function ProfilePage() {
  const { userId } = useAuth();
  const clerk = useClerk();
  const queryClient = useQueryClient();
  const me = useMe();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (!userId || isSigningOut) {
      return;
    }

    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await clearPersistedQueryCache(userId);
      queryClient.clear();
      await clerk.signOut({ redirectUrl: "/sign-in" });
    } catch {
      setSignOutError("We couldn't sign you out. Please try again.");
      setIsSigningOut(false);
    }
  };

  if (me.isPending) {
    return <LoadingSkeleton label="Loading your profile" rows={4} />;
  }

  if (me.isError || !me.data) {
    return <ErrorState onRetry={() => void me.refetch()} />;
  }

  const details = [
    { label: "Name", value: me.data.display_name || "Not set" },
    { label: "Email", value: me.data.email || "Not available" },
    { label: "Timezone", value: me.data.timezone },
    { label: "Currency", value: me.data.currency },
  ];

  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        Account
      </p>
      <h2 className="mb-5 text-3xl font-bold tracking-tight text-foreground">
        Profile
      </h2>
      <dl className="divide-y divide-outline rounded-3xl border border-outline bg-panel px-5">
        {details.map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-wrap items-center justify-between gap-2 py-4"
          >
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="break-all text-right text-sm font-medium text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {signOutError && (
        <p aria-live="polite" className="mt-4 text-sm text-alert" role="alert">
          {signOutError}
        </p>
      )}
      <Button
        className="mt-6"
        disabled={isSigningOut}
        onClick={() => void handleSignOut()}
        variant="outlined"
      >
        {isSigningOut ? "Signing out…" : "Sign out"}
      </Button>
    </section>
  );
}
