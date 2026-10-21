"use client";

import { useCallback, useEffect, useState } from "react";

type OnboardingStatus = "done" | "skipped";

type OnboardingSnapshot = {
  userId: string | null;
  isLoaded: boolean;
  status: OnboardingStatus | null;
  hasError: boolean;
};

function parseStatus(value: string | null): OnboardingStatus | null {
  if (!value) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("status" in parsed) ||
    !("timestamp" in parsed)
  ) {
    return null;
  }

  const { status, timestamp } = parsed;
  if (
    (status !== "done" && status !== "skipped") ||
    typeof timestamp !== "string" ||
    !Number.isFinite(Date.parse(timestamp))
  ) {
    return null;
  }

  return status;
}

export function useOnboardingState(userId: string | null | undefined) {
  const [snapshot, setSnapshot] = useState<OnboardingSnapshot>({
    userId: null,
    isLoaded: false,
    status: null,
    hasError: false,
  });

  const refresh = useCallback(() => {
    if (!userId) {
      setSnapshot({
        userId: null,
        isLoaded: true,
        status: null,
        hasError: false,
      });
      return;
    }

    try {
      const status = parseStatus(
        localStorage.getItem(`largent-onboarding:${userId}`),
      );
      setSnapshot({ userId, isLoaded: true, status, hasError: false });
    } catch {
      console.error("Unable to read onboarding progress from local storage.");
      setSnapshot({ userId, isLoaded: true, status: null, hasError: true });
    }
  }, [userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const saveStatus = useCallback(
    (status: OnboardingStatus): boolean => {
      if (!userId) {
        console.error("Unable to save onboarding progress without a user.");
        setSnapshot({
          userId: null,
          isLoaded: true,
          status: null,
          hasError: true,
        });
        return false;
      }

      try {
        localStorage.setItem(
          `largent-onboarding:${userId}`,
          JSON.stringify({ status, timestamp: new Date().toISOString() }),
        );
        setSnapshot({ userId, isLoaded: true, status, hasError: false });
        return true;
      } catch {
        console.error("Unable to save onboarding progress to local storage.");
        setSnapshot((current) => ({
          userId,
          isLoaded: true,
          status: current.userId === userId ? current.status : null,
          hasError: true,
        }));
        return false;
      }
    },
    [userId],
  );

  const complete = useCallback(() => saveStatus("done"), [saveStatus]);
  const skip = useCallback(() => saveStatus("skipped"), [saveStatus]);
  const isCurrentUser = snapshot.userId === userId;
  const isLoaded = isCurrentUser && snapshot.isLoaded;
  const status = isCurrentUser ? snapshot.status : null;

  return {
    isLoaded,
    hasError: isLoaded && snapshot.hasError,
    done: isLoaded && status === "done",
    skipped: isLoaded && status === "skipped",
    complete,
    skip,
    refresh,
  };
}
