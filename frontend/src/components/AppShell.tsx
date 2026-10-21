"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useMe, useUpdateMe } from "@/features/me/api";
import { AppNavigation } from "./AppNavigation";
import { PageContainer } from "./PageContainer";
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
      <main className="min-h-dvh w-full pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-10 md:pb-10 lg:pt-24">
        <PageContainer>
          <OfflineBanner />
          <div className="flex-1">{children}</div>
        </PageContainer>
      </main>
    </div>
  );
}
