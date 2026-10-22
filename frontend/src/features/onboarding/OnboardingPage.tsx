"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { Check, UserRound, Wallet } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { Logo } from "@/components/brand/Logo";
import { ToastViewport } from "@/components/states/ToastViewport";
import { useAccounts } from "@/features/accounts/api";
import { useBudgets } from "@/features/budgets/api";
import { useCategories } from "@/features/categories/api";
import { useMe } from "@/features/me/api";
import { formatGhs } from "@/lib/money";
import { showToast } from "@/lib/toast";
import { OnboardingAccountForm } from "./OnboardingAccountForm";
import { OnboardingBudgetStep, type OnboardingBudgetDraft } from "./OnboardingBudgetStep";
import { onboardingCopy } from "./copy";
import { OnboardingDetailsForm } from "./OnboardingDetailsForm";
import {
  ONBOARDING_STEP_COUNT,
  type OnboardingStep,
  useOnboardingStep,
} from "./useOnboardingStep";
import { useOnboardingState } from "./useOnboardingState";

const illustrationSize = 500;

function IntroAnimation() {
  return (
    <section
      aria-label={onboardingCopy.welcome.introLabel}
      className="order-2 card-surface overflow-hidden p-2 sm:p-3 motion-reduce:hidden lg:order-1"
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
      <p className="sr-only">{onboardingCopy.welcome.introText}</p>
      <div className="px-2 pt-2">
        <span className="text-sm text-muted">
          {onboardingCopy.welcome.introCaption}
        </span>
      </div>
    </section>
  );
}

function IllustrationCard() {
  return (
    <section className="order-2 card-surface hidden aspect-square flex-col items-center justify-center gap-5 overflow-hidden bg-gradient-to-br from-selected to-panel p-8 text-center motion-reduce:flex lg:order-1">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-panel text-brand shadow-sm">
        <Wallet aria-hidden="true" size={40} strokeWidth={1.7} />
      </div>
      <div className="max-w-sm">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {onboardingCopy.welcome.illustrationTitle}
        </h2>
        <p className="mt-3 leading-6 text-muted">
          {onboardingCopy.welcome.illustrationDescription}
        </p>
      </div>
    </section>
  );
}

function stepContent(step: OnboardingStep) {
  switch (step) {
    case 2:
      return {
        title: onboardingCopy.details.title,
        description: onboardingCopy.details.description,
        icon: <UserRound aria-hidden="true" size={28} />,
      };
    case 3:
      return {
        title: onboardingCopy.accounts.title,
        description: onboardingCopy.accounts.description,
        icon: <Wallet aria-hidden="true" size={28} />,
      };
    case 4:
      return {
        title: onboardingCopy.budget.title,
        description: onboardingCopy.budget.description,
        icon: <Wallet aria-hidden="true" size={28} />,
      };
    case 5:
      return {
        title: onboardingCopy.complete.title,
        description: onboardingCopy.complete.description,
        icon: <Check aria-hidden="true" size={28} />,
      };
    case 1:
      return {
        title: onboardingCopy.welcome.title,
        description: onboardingCopy.welcome.description,
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

export function OnboardingPage({ isReplay = false }: { isReplay?: boolean }) {
  const { userId } = useAuth();
  const { isLoaded: isClerkUserLoaded, user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const onboarding = useOnboardingState(userId);
  const progress = useOnboardingStep(userId, !isReplay);
  const me = useMe();
  const accounts = useAccounts();
  const categories = useCategories({ kind: "expense" });
  const budgets = useBudgets();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [budgetDrafts, setBudgetDrafts] = useState<
    Record<string, OnboardingBudgetDraft>
  >({});
  const content = stepContent(progress.step);
  const needsUser = progress.step === 2 || progress.step === 5;
  const needsAccounts = progress.step === 3 || progress.step === 5;
  const needsBudgetData = progress.step === 4 || progress.step === 5;
  const needsCategories = progress.step === 4 && !isReplay;
  const isDataPending =
    (needsUser && (!isClerkUserLoaded || (!me.data && me.isPending))) ||
    (needsAccounts && !accounts.data && accounts.isPending) ||
    (needsBudgetData && !budgets.data && budgets.isPending) ||
    (needsCategories && !categories.data && categories.isPending);

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
    headingRef.current?.focus();
  }, [isDataPending, onboarding.isLoaded, progress.isLoaded, progress.step]);

  useEffect(() => {
    if (progress.hasError) {
      showToast(onboardingCopy.errors.onboardingStepSave, "warning");
    }
  }, [progress.hasError]);

  if (!onboarding.isLoaded || !progress.isLoaded) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5">
        <LoadingSkeleton label={onboardingCopy.loading.onboarding} rows={3} />
      </main>
    );
  }

  if (onboarding.hasError) {
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

  if (isDataPending) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5">
        <LoadingSkeleton label={onboardingCopy.loading.setup} rows={3} />
      </main>
    );
  }

  const hasDataError =
    (needsUser && (!me.data || me.isError)) ||
    (needsAccounts && (!accounts.data || accounts.isError)) ||
    (needsBudgetData && (!budgets.data || budgets.isError)) ||
    (needsCategories && (!categories.data || categories.isError));

  if (hasDataError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-5">
        <ErrorState
          description={
            progress.step === 4
              ? onboardingCopy.budget.loadError
              : onboardingCopy.errors.setupLoadDescription
          }
          onRetry={() => {
            void Promise.all([
              me.refetch(),
              accounts.refetch(),
              categories.refetch(),
              budgets.refetch(),
            ]);
          }}
          title={onboardingCopy.errors.setupLoadTitle}
        />
      </main>
    );
  }

  function handleSkip() {
    if (isReplay) {
      router.replace("/profile");
      return;
    }
    if (onboarding.skip()) {
      progress.clear();
      router.replace("/");
    } else {
      showToast(onboardingCopy.errors.progressSave, "error");
    }
  }

  function handleNext() {
    if (progress.step === ONBOARDING_STEP_COUNT) return;
    progress.setStep(nextStep(progress.step));
  }

  function handleBack() {
    if (progress.step > 1) progress.setStep(previousStep(progress.step));
  }

  async function handleFinish() {
    if (isReplay) {
      router.replace("/profile");
      return;
    }
    if (!onboarding.complete()) {
      showToast(onboardingCopy.errors.finishSave, "error");
      return;
    }

    await Promise.all(
      [
        ["me"],
        ["accounts"],
        ["categories"],
        ["budgets"],
        ["dashboard"],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
    if (!progress.clear()) {
      showToast(onboardingCopy.errors.finishClear, "warning");
    }
    router.replace("/");
  }

  function updateBudgetDraft(
    categoryId: string,
    draft: OnboardingBudgetDraft,
  ) {
    setBudgetDrafts((current) => ({ ...current, [categoryId]: draft }));
  }

  const activeBudgets = (budgets.data ?? []).filter(
    (budget) => !budget.is_archived,
  );
  const displayName =
    me.data?.display_name?.trim() ||
    user?.fullName?.trim() ||
    onboardingCopy.complete.fallbackName;
  const stepIsOptional = progress.step === 4;

  return (
    <main className="min-h-dvh bg-page px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-foreground sm:px-6">
      <ToastViewport />
      <div className="mx-auto flex w-full max-w-6xl flex-col">
        <header className="flex min-h-12 items-center justify-between gap-4">
          <Logo />
          <Button className="min-h-11" onClick={handleSkip} variant="text">
            {isReplay
              ? onboardingCopy.header.returnToProfile
              : onboardingCopy.header.skip}
          </Button>
        </header>

        <section className="mx-auto mt-8 w-full max-w-5xl">
          <div className="mb-8">
            <p
              aria-atomic="true"
              aria-live="polite"
              className="text-sm font-medium text-muted"
            >
              {onboardingCopy.navigation.step(progress.step)}
            </p>
            <ol
              aria-label={onboardingCopy.navigation.progressLabel}
              className="mt-3 grid grid-cols-5 gap-2"
            >
              {onboardingCopy.steps.map((label, index) => {
                const number = index + 1;
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
              {onboardingCopy.errors.onboardingStepRestore}
            </Alert>
          )}

          {isReplay && (
            <Alert className="mb-5" severity="info">
              {onboardingCopy.errors.readOnly}
            </Alert>
          )}

          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2 lg:gap-12">
            <IntroAnimation />
            <IllustrationCard />
            <section
              aria-labelledby="onboarding-step-title"
              className="order-1 card-surface p-6 sm:p-8 lg:order-2 lg:p-10"
            >
              {progress.step !== 1 && (
                <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-selected text-brand">
                  {content.icon}
                </div>
              )}
              <h1
                className="text-3xl font-bold tracking-tight text-foreground"
                id="onboarding-step-title"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const activeForm = Array.from(
                    event.currentTarget
                      .closest("section")
                      ?.querySelectorAll("form") ?? [],
                  ).find((form) => !form.closest("[hidden]"));
                  if (activeForm) activeForm.requestSubmit();
                  else handleNext();
                }}
                ref={headingRef}
                tabIndex={-1}
              >
                {content.title}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted">
                {content.description}
              </p>

              {stepIsOptional && (
                <span className="mt-3 inline-flex rounded-full bg-panel-raised px-3 py-1 text-sm font-medium text-foreground">
                  {onboardingCopy.navigation.optional}
                </span>
              )}

              {stepIsOptional && !isOnline && (
                <p className="mt-4 text-sm font-medium text-muted" role="status">
                  {onboardingCopy.accounts.offlineAdd}
                </p>
              )}

              {progress.step === 2 && isReplay && me.data && (
                <dl className="mt-6 space-y-3 rounded-xl bg-panel-raised p-4">
                  <div>
                    <dt className="text-sm text-muted">
                      {onboardingCopy.complete.name}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {displayName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted">
                      {onboardingCopy.details.timezoneLabel}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {me.data.timezone}
                    </dd>
                  </div>
                </dl>
              )}

              {progress.step === 3 && isReplay && accounts.data && (
                <section
                  aria-labelledby="onboarding-replay-accounts"
                  className="mt-6"
                >
                  <h2
                    className="text-base font-semibold text-foreground"
                    id="onboarding-replay-accounts"
                  >
                    {onboardingCopy.replay.accountTitle}
                  </h2>
                  {accounts.data.length ? (
                    <ul className="mt-3 divide-y divide-outline overflow-hidden rounded-xl border border-outline">
                      {accounts.data.map((account) => (
                        <li
                          className="flex items-center justify-between gap-4 bg-panel px-4 py-3"
                          key={account.id}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {account.name}
                            </span>
                            <span className="block text-sm capitalize text-muted">
                              {account.type.replace("_", " ")}
                            </span>
                          </span>
                          <span className="money shrink-0 font-semibold text-foreground">
                            {formatGhs(account.balance_minor)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted">
                      {onboardingCopy.replay.noAccounts}
                    </p>
                  )}
                </section>
              )}

              {progress.step === 4 && isReplay && (
                <section aria-labelledby="onboarding-replay-budgets" className="mt-6">
                  <h2
                    className="text-base font-semibold text-foreground"
                    id="onboarding-replay-budgets"
                  >
                    {onboardingCopy.budget.replayLabel}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {onboardingCopy.budget.replayDescription}
                  </p>
                  {activeBudgets.length ? (
                    <ul className="mt-3 divide-y divide-outline overflow-hidden rounded-xl border border-outline">
                      {activeBudgets.map((budget) => (
                        <li
                          className="flex items-center justify-between gap-4 bg-panel px-4 py-3"
                          key={budget.id}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {budget.category_name}
                            </span>
                            <span className="block text-sm capitalize text-muted">
                              {budget.period}
                            </span>
                          </span>
                          <span className="money shrink-0 font-semibold text-foreground">
                            {formatGhs(budget.limit_minor)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted">
                      {onboardingCopy.budget.noBudgets}
                    </p>
                  )}
                </section>
              )}

              {!isReplay && me.data && (
                <div hidden={progress.step !== 2}>
                  <OnboardingDetailsForm
                    clerkName={user?.fullName?.trim() ?? ""}
                    isOnline={isOnline}
                    onBack={handleBack}
                    onContinue={() => progress.setStep(3)}
                    user={me.data}
                  />
                </div>
              )}
              {!isReplay && accounts.data && (
                <div hidden={progress.step !== 3}>
                  <OnboardingAccountForm
                    accounts={accounts.data}
                    isOnline={isOnline}
                    onBack={handleBack}
                    onContinue={() => progress.setStep(4)}
                  />
                </div>
              )}

              {!isReplay && categories.data && budgets.data && (
                <div hidden={progress.step !== 4}>
                  <OnboardingBudgetStep
                    budgets={budgets.data}
                    categories={categories.data}
                    drafts={budgetDrafts}
                    isOnline={isOnline}
                    onBack={handleBack}
                    onContinue={() => progress.setStep(5)}
                    onDraftChange={updateBudgetDraft}
                  />
                </div>
              )}

              {(progress.step === 1 || progress.step === 5) && (
                <form
                  className="mt-8"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (progress.step === 5) void handleFinish();
                    else handleNext();
                  }}
                >
                  {progress.step === 5 && me.data && accounts.data && (
                    <dl className="mb-6 space-y-3 rounded-xl bg-panel-raised p-4">
                      <div>
                        <dt className="text-sm text-muted">
                          {onboardingCopy.complete.name}
                        </dt>
                        <dd className="font-medium text-foreground">
                          {displayName}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted">
                          {onboardingCopy.replay.accountTitle}
                        </dt>
                        <dd className="font-medium text-foreground">
                          {onboardingCopy.complete.accounts(accounts.data.length)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm text-muted">
                          {onboardingCopy.budget.replayLabel}
                        </dt>
                        <dd className="font-medium text-foreground">
                          {onboardingCopy.complete.budgets(activeBudgets.length)}
                        </dd>
                      </div>
                    </dl>
                  )}
                  {isReplay && progress.step === 5 ? (
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                      <Button
                        className="min-h-11"
                        onClick={handleBack}
                        type="button"
                        variant="outlined"
                      >
                        {onboardingCopy.navigation.back}
                      </Button>
                      <Button className="min-h-11" type="submit" variant="contained">
                        {onboardingCopy.complete.profile}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                      <Button
                        className="min-h-11"
                        disabled={progress.step === 1}
                        onClick={handleBack}
                        type="button"
                        variant="outlined"
                      >
                        {onboardingCopy.navigation.back}
                      </Button>
                      <div className="flex flex-col-reverse gap-3 sm:flex-row">
                        {progress.step === 5 && (
                          <Button
                            className="min-h-11"
                            component={Link}
                            href="/transactions/new?kind=expense"
                            variant="outlined"
                          >
                            {onboardingCopy.complete.transaction}
                          </Button>
                        )}
                        <Button className="min-h-11" type="submit" variant="contained">
                          {progress.step === 1
                            ? onboardingCopy.navigation.getStarted
                            : isReplay
                              ? onboardingCopy.complete.profile
                              : onboardingCopy.complete.home}
                        </Button>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {progress.step === 2 && isReplay && (
                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button
                    className="min-h-11"
                    onClick={handleBack}
                    variant="outlined"
                  >
                    {onboardingCopy.navigation.back}
                  </Button>
                  <Button
                    className="min-h-11"
                    onClick={handleNext}
                    variant="contained"
                  >
                    {onboardingCopy.navigation.next}
                  </Button>
                </div>
              )}
              {progress.step === 3 && isReplay && (
                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button
                    className="min-h-11"
                    onClick={handleBack}
                    variant="outlined"
                  >
                    {onboardingCopy.navigation.back}
                  </Button>
                  <Button
                    className="min-h-11"
                    onClick={handleNext}
                    variant="contained"
                  >
                    {onboardingCopy.navigation.next}
                  </Button>
                </div>
              )}
              {progress.step === 4 && isReplay && (
                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                  <Button
                    className="min-h-11"
                    onClick={handleBack}
                    variant="outlined"
                  >
                    {onboardingCopy.navigation.back}
                  </Button>
                  <Button
                    className="min-h-11"
                    onClick={handleNext}
                    variant="contained"
                  >
                    {onboardingCopy.navigation.next}
                  </Button>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
