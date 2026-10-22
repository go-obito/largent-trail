"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccounts } from "@/features/accounts/api";
import { useMe } from "@/features/me/api";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { onboardingCopy } from "./copy";
import { useOnboardingState } from "./useOnboardingState";

const excludedPaths = ["/onboarding", "/sign-in", "/sign-up"];

function isExcludedPath(pathname: string | null): boolean {
  return excludedPaths.some(
    (path) => pathname === path || pathname?.startsWith(`${path}/`),
  );
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { isLoaded: isAuthLoaded, isSignedIn, userId } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const accounts = useAccounts();
  const onboarding = useOnboardingState(userId);
  const { complete, done, hasError, isLoaded: isOnboardingLoaded, skipped } = onboarding;
  const hasAccounts = (accounts.data?.length ?? 0) > 0;
  const excluded = isExcludedPath(pathname);

  useEffect(() => {
    if (
      !isAuthLoaded ||
      !isSignedIn ||
      !userId ||
      excluded ||
      !me.isSuccess ||
      !accounts.isSuccess ||
      !isOnboardingLoaded ||
      (hasError && !hasAccounts)
    ) {
      return;
    }

    if (hasAccounts) {
      if (!done) complete();
      return;
    }

    if (!done && !skipped) {
      router.replace("/onboarding");
    }
  }, [
    accounts.isSuccess,
    complete,
    done,
    excluded,
    hasError,
    hasAccounts,
    isAuthLoaded,
    isOnboardingLoaded,
    isSignedIn,
    me.isSuccess,
    router,
    skipped,
    userId,
  ]);

  if (excluded || (isAuthLoaded && !isSignedIn)) return <>{children}</>;

  if (
    !isAuthLoaded ||
    !userId ||
    !me.isSuccess ||
    !accounts.isSuccess ||
    !isOnboardingLoaded
  ) {
    if (me.isError || accounts.isError || hasError) {
      return (
        <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5">
          <ErrorState
            description={onboardingCopy.errors.accountCheckDescription}
            onRetry={() => {
              void Promise.all([me.refetch(), accounts.refetch()]);
              onboarding.refresh();
            }}
            title={onboardingCopy.errors.accountCheckTitle}
          />
        </main>
      );
    }

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5">
        <LoadingSkeleton label={onboardingCopy.loading.preparing} rows={3} />
      </main>
    );
  }

  if (hasError && !hasAccounts) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5">
        <ErrorState
          description={onboardingCopy.errors.progressReadDescription}
          onRetry={onboarding.refresh}
          title={onboardingCopy.errors.progressReadTitle}
        />
      </main>
    );
  }

  if (hasAccounts || done || skipped) {
    return <>{children}</>;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5">
      <LoadingSkeleton label={onboardingCopy.loading.opening} rows={3} />
    </main>
  );
}
