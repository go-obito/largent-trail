"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useMe, useUpdateMe } from "@/features/me/api";
import { AppNavigation } from "./AppNavigation";
import { OfflineBanner } from "./states/OfflineBanner";
import { ToastViewport } from "./states/ToastViewport";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoaded: isClerkLoaded, user } = useUser();
  const me = useMe();
  const { mutateAsync: updateDisplayName } = useUpdateMe();
  const hasAttemptedNameUpdate = useRef(false);

  useEffect(() => {
    if (
      !isClerkLoaded ||
      !me.isSuccess ||
      me.data.display_name?.trim() ||
      hasAttemptedNameUpdate.current
    ) {
      return;
    }

    const displayName = user?.fullName?.trim() || user?.firstName?.trim();
    if (!displayName) {
      return;
    }

    hasAttemptedNameUpdate.current = true;
    void updateDisplayName({ display_name: displayName }).catch(() => {
      console.error("Unable to initialize the user's display name.");
    });
  }, [isClerkLoaded, me.data, me.isSuccess, updateDisplayName, user]);

  return (
    <div className="min-h-dvh bg-page text-foreground md:pl-20 lg:pl-60">
      <AppNavigation />
      <ToastViewport />
      <main className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-10 md:pb-10">
        <OfflineBanner />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
