"use client";

import { useAuth } from "@clerk/nextjs";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { Check, UserRound, Wallet } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { Logo } from "@/components/brand/Logo";
import { showToast } from "@/lib/toast";
import {
  ONBOARDING_STEP_COUNT,
  type OnboardingStep,
  useOnboardingStep,
} from "./useOnboardingStep";
import { useOnboardingState } from "./useOnboardingState";
import { ToastViewport } from "@/components/states/ToastViewport";

const steps = [
  { number: 1, label: "Welcome" },
  { number: 2, label: "Your details" },
  { number: 3, label: "First account" },
  { number: 4, label: "Starter budget" },
  { number: 5, label: "All set" },
] as const;

const illustrationSize = 500;

function IntroAnimation() {
  return (
    <section
      aria-label="Largent introduction animation"
      className="card-surface overflow-hidden p-2 sm:p-3 motion-reduce:hidden"
    >
      <div
        className="overflow-hidden rounded-[calc(var(--radius-card)-8px)] bg-panel-raised"
        style={{ aspectRatio: 1 }}
      >
        <Image
          alt=""
          aria-hidden="true"
          className="size-full object-contain"
          height={illustrationSize}
          src="/manage-money-animate.svg"
          width={illustrationSize}
        />
      </div>
      <p className="sr-only">
        An animation introducing Largent and everyday money management.
      </p>
      <div className="px-2 pt-2">
        <span className="text-sm text-muted">A quick introduction</span>
      </div>
    </section>
  );
}

function IllustrationCard() {
  return (
    <section className="card-surface hidden aspect-square flex-col items-center justify-center gap-5 overflow-hidden bg-gradient-to-br from-selected to-panel p-8 text-center motion-reduce:flex">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-panel text-brand shadow-sm">
        <Wallet aria-hidden="true" size={40} strokeWidth={1.7} />
      </div>
      <div className="max-w-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Know what you can spend today.
        </h2>
        <p className="mt-3 leading-6 text-muted">
          Largent turns your budget into a simple daily limit.
        </p>
      </div>
    </section>
  );
}

function stepContent(step: OnboardingStep) {
  switch (step) {
    case 2:
      return {
        title: "Your details",
        description:
          "This setup step is coming in a later checkpoint. You can keep using Largent and update your details anytime.",
        icon: <UserRound aria-hidden="true" size={28} />,
      };
    case 3:
      return {
        title: "First account",
        description:
          "Your first account can also be created inline from the transaction form, so you can safely skip this step.",
        icon: <Wallet aria-hidden="true" size={28} />,
      };
    case 4:
      return {
        title: "Starter budget",
        description:
          "This optional setup step is coming in a later checkpoint. You can create a budget anytime.",
        icon: <Wallet aria-hidden="true" size={28} />,
      };
    case 5:
      return {
        title: "All set",
        description:
          "You're ready to start using Largent. You can add an account later from the transaction form.",
        icon: <Check aria-hidden="true" size={28} />,
      };
    case 1:
      return {
        title: "Welcome to Largent",
        description:
          "Know what you can spend today. Largent turns your budget into a simple daily limit.",
        icon: <Wallet aria-hidden="true" size={28} />,
      };
  }
}

function nextStep(step: OnboardingStep): OnboardingStep {
  switch (step) {
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return 4;
    case 4:
      return 5;
    case 5:
      return 5;
  }
}

function previousStep(step: OnboardingStep): OnboardingStep {
  switch (step) {
    case 1:
      return 1;
    case 2:
      return 1;
    case 3:
      return 2;
    case 4:
      return 3;
    case 5:
      return 4;
  }
}

export function OnboardingPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const onboarding = useOnboardingState(userId);
  const progress = useOnboardingStep(userId);
  const [isOnline, setIsOnline] = useState(true);
  const content = stepContent(progress.step);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (progress.hasError) {
      showToast(
        "Your onboarding step couldn't be saved for this session.",
        "warning",
      );
    }
  }, [progress.hasError]);

  if (!onboarding.isLoaded || !progress.isLoaded) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5">
        <LoadingSkeleton label="Loading onboarding" rows={3} />
      </main>
    );
  }

  if (onboarding.hasError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5">
        <ErrorState
          description="We couldn't read your onboarding progress. Try again to continue."
          onRetry={onboarding.refresh}
          title="Unable to read your setup status"
        />
      </main>
    );
  }

  function handleSkip() {
    if (onboarding.skip()) {
      router.replace("/");
    } else {
      showToast(
        "Your progress couldn't be saved. Please try again.",
        "error",
      );
    }
  }

  function handleNext() {
    if (progress.step === ONBOARDING_STEP_COUNT) {
      if (onboarding.complete()) router.replace("/");
      else showToast("Your progress couldn't be saved. Please try again.", "error");
      return;
    }
    progress.setStep(nextStep(progress.step));
  }

  function handleBack() {
    if (progress.step > 1) progress.setStep(previousStep(progress.step));
  }

  const isWriteStep = progress.step === 2 || progress.step === 3 || progress.step === 4;

  return (
    <main className="min-h-dvh bg-page px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-foreground sm:px-6">
      <ToastViewport />
      <div className="mx-auto flex w-full max-w-6xl flex-col">
        <header className="flex min-h-12 items-center justify-between gap-4">
          <Logo />
          <Button
            className="min-h-11"
            onClick={handleSkip}
            variant="text"
          >
            Skip for now
          </Button>
        </header>

        <section className="mx-auto mt-8 w-full max-w-5xl">
          <div className="mb-8">
            <p className="text-sm font-medium text-muted">
              Step {progress.step} of {ONBOARDING_STEP_COUNT}
            </p>
            <ol
              aria-label="Onboarding progress"
              className="mt-3 grid grid-cols-5 gap-2"
            >
              {steps.map(({ number, label }) => {
                const isActive = progress.step === number;
                const isComplete = progress.step > number;
                return (
                  <li
                    aria-current={isActive ? "step" : undefined}
                    className="min-w-0"
                    key={label}
                  >
                    <div
                      aria-hidden="true"
                      className={`h-1.5 rounded-full ${
                        isActive || isComplete
                          ? "bg-brand"
                          : "bg-panel-raised"
                      }`}
                    />
                    <span
                      className={`mt-2 hidden truncate text-xs sm:block ${
                        isActive ? "font-semibold text-foreground" : "text-muted"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {progress.hasError && (
            <Alert className="mb-5" severity="warning">
              Your current step may not be restored after refreshing this page.
            </Alert>
          )}

          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-12">
            <IntroAnimation />
            <IllustrationCard />
            <section
              aria-labelledby="onboarding-step-title"
              className="card-surface p-6 sm:p-8 lg:p-10"
            >
              {progress.step !== 1 && (
                <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-selected text-brand">
                  {content.icon}
                </div>
              )}
              <h1
                className="text-3xl font-bold tracking-tight text-foreground"
                id="onboarding-step-title"
              >
                {content.title}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted">
                {content.description}
              </p>
              {progress.step === 4 && (
                <span className="mt-3 inline-flex rounded-full bg-panel-raised px-3 py-1 text-sm font-medium text-foreground">
                  Optional
                </span>
              )}
              {isWriteStep && !isOnline && (
                <p className="mt-4 text-sm font-medium text-muted" role="status">
                  You&apos;re offline. Connect to continue, or skip for now.
                </p>
              )}
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button
                  className="min-h-11"
                  disabled={progress.step === 1}
                  onClick={handleBack}
                  variant="outlined"
                >
                  Back
                </Button>
                <Button
                  className="min-h-11"
                  disabled={isWriteStep && !isOnline}
                  onClick={handleNext}
                  variant="contained"
                >
                  {progress.step === 1
                    ? "Get started"
                    : progress.step === ONBOARDING_STEP_COUNT
                      ? "Finish"
                      : "Next"}
                </Button>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
