"use client";

import { useCallback, useEffect, useState } from "react";

export const ONBOARDING_STEP_COUNT = 5;
export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

type StepSnapshot = {
  userId: string | null;
  isLoaded: boolean;
  step: OnboardingStep;
  hasError: boolean;
};

function isOnboardingStep(value: number): value is OnboardingStep {
  return Number.isInteger(value) && value >= 1 && value <= ONBOARDING_STEP_COUNT;
}

export function useOnboardingStep(userId: string | null | undefined) {
  const [snapshot, setSnapshot] = useState<StepSnapshot>({
    userId: null,
    isLoaded: false,
    step: 1,
    hasError: false,
  });

  const refresh = useCallback(() => {
    if (!userId) {
      setSnapshot({
        userId: null,
        isLoaded: true,
        step: 1,
        hasError: false,
      });
      return;
    }

    try {
      const storedStep = sessionStorage.getItem(
        `largent-onboarding-step:${userId}`,
      );
      const step = storedStep === null ? 1 : Number(storedStep);
      setSnapshot({
        userId,
        isLoaded: true,
        step: isOnboardingStep(step) ? step : 1,
        hasError: false,
      });
    } catch {
      console.error("Unable to restore the onboarding step from this session.");
      setSnapshot({ userId, isLoaded: true, step: 1, hasError: true });
    }
  }, [userId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const setStep = useCallback(
    (step: OnboardingStep) => {
      if (!userId) {
        console.error("Unable to save the onboarding step without a user.");
        setSnapshot({
          userId: null,
          isLoaded: true,
          step,
          hasError: true,
        });
        return;
      }

      try {
        sessionStorage.setItem(
          `largent-onboarding-step:${userId}`,
          String(step),
        );
        setSnapshot({ userId, isLoaded: true, step, hasError: false });
      } catch {
        console.error("Unable to save the onboarding step to this session.");
        setSnapshot({ userId, isLoaded: true, step, hasError: true });
      }
    },
    [userId],
  );

  const isCurrentUser = snapshot.userId === userId;
  return {
    isLoaded: isCurrentUser && snapshot.isLoaded,
    hasError: isCurrentUser && snapshot.hasError,
    step: isCurrentUser ? snapshot.step : 1,
    setStep,
    refresh,
  };
}
