"use client";

import { useAuth } from "@clerk/nextjs";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import {
  Check,
  Pause,
  Play,
  RotateCcw,
  UserRound,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

const videoAspectRatio = 1;
const videoSource = "/Manage%20money%20onboarding%20video.mp4#t=0.001";

type IntroVideoProps = {
  active: boolean;
};

function IntroVideo({ active }: IntroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoplayAttempted = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!active || !isReady || !video || autoplayAttempted.current) return;

    autoplayAttempted.current = true;
    const saveData = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection?.saveData;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion || saveData === true) return;

    void video
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        setIsPlaying(false);
      });
  }, [active, isReady]);

  async function playVideo() {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setHasEnded(false);
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      showToast("The intro couldn't be played. You can continue without it.", "error");
    }
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void playVideo();
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function replayVideo() {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    void playVideo();
  }

  if (hasFailed) {
    return <IllustrationCard />;
  }

  return (
    <section
      aria-label="Largent introduction video"
      className="card-surface overflow-hidden p-2 sm:p-3"
    >
      <div
        className="relative overflow-hidden rounded-[calc(var(--radius-card)-8px)] bg-panel-raised"
        style={{ aspectRatio: videoAspectRatio }}
      >
        <video
          aria-describedby="onboarding-video-description"
          className="size-full object-cover"
          muted
          onEnded={() => {
            setIsPlaying(false);
            setHasEnded(true);
          }}
          onError={() => setHasFailed(true)}
          onLoadedData={() => setIsReady(true)}
          playsInline
          preload="metadata"
          ref={videoRef}
        >
          <source src={videoSource} type="video/mp4" />
          Your browser does not support the intro video.
        </video>
        {!isPlaying && (
          <Button
            className="absolute inset-x-4 bottom-4 mx-auto w-fit"
            onClick={() => {
              if (hasEnded) replayVideo();
              else void playVideo();
            }}
            startIcon={<Play aria-hidden="true" size={18} />}
            variant="contained"
          >
            {hasEnded ? "Replay intro" : "Play intro"}
          </Button>
        )}
      </div>
      <p className="sr-only" id="onboarding-video-description">
        A short animated introduction to managing money with Largent.
      </p>
      <div className="flex items-center justify-between gap-3 px-2 pt-2">
        <span className="text-sm text-muted">A quick introduction</span>
        <div className="flex items-center gap-1">
          {hasEnded && (
            <Button
              onClick={replayVideo}
              size="small"
              startIcon={<RotateCcw aria-hidden="true" size={16} />}
              variant="text"
            >
              Replay
            </Button>
          )}
          <IconButton
            aria-label={isPlaying ? "Pause intro video" : "Play intro video"}
            onClick={togglePlayback}
            size="large"
          >
            {isPlaying ? (
              <Pause aria-hidden="true" size={20} />
            ) : (
              <Play aria-hidden="true" size={20} />
            )}
          </IconButton>
        </div>
      </div>
    </section>
  );
}

function IllustrationCard() {
  return (
    <section className="card-surface flex aspect-square flex-col items-center justify-center gap-5 overflow-hidden bg-gradient-to-br from-selected to-panel p-8 text-center">
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
            <IntroVideo active={progress.step === 1} />
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
