"use client";

import Button from "@mui/material/Button";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { IntroVideo, IntroStaticFrame } from "./IntroVideo";
import { welcomeCopy } from "./copy";

const seenKey = "largent-welcome-seen";

function subscribeToWelcomeFlag(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getWelcomeFlag(): boolean | null {
  return window.localStorage.getItem(seenKey) !== null;
}

function getServerWelcomeFlag(): null {
  return null;
}

function rememberWelcome(): void {
  window.localStorage.setItem(seenKey, "true");
}

export function WelcomeExperience({ forceFull }: { forceFull: boolean }) {
  const seenWelcome = useSyncExternalStore(
    subscribeToWelcomeFlag,
    getWelcomeFlag,
    getServerWelcomeFlag,
  );
  const isReady = forceFull || seenWelcome !== null;
  const isReturning = !forceFull && seenWelcome === true;
  const [showIntro, setShowIntro] = useState(false);

  const actions = (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button
        className="w-full sm:w-auto"
        component={Link}
        href={isReturning ? welcomeCopy.paths.signIn : welcomeCopy.paths.signUp}
        onClick={rememberWelcome}
        sx={{
          minHeight: 52,
          borderRadius: "14px",
          fontSize: "1rem",
          fontWeight: 600,
          textTransform: "none",
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        }}
        variant="contained"
      >
        {isReturning
          ? welcomeCopy.actions.signIn
          : welcomeCopy.actions.getStarted}
      </Button>
      <Button
        className="w-full sm:w-auto"
        component={Link}
        href={isReturning ? welcomeCopy.paths.signUp : welcomeCopy.paths.signIn}
        onClick={rememberWelcome}
        sx={{
          minHeight: 52,
          borderColor: "var(--color-border)",
          borderRadius: "14px",
          color: "var(--color-text-primary)",
          fontSize: "1rem",
          fontWeight: 600,
          textTransform: "none",
          "&:hover": {
            borderColor: "var(--color-primary)",
            backgroundColor: "var(--color-selected-surface)",
          },
        }}
        variant="outlined"
      >
        {isReturning
          ? welcomeCopy.actions.createAccount
          : welcomeCopy.actions.alreadyHaveAccount}
      </Button>
    </div>
  );

  if (isReady && isReturning) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col gap-8 pb-12 pt-8 sm:pt-16">
        <div className="space-y-4">
          <h1 className="max-w-[14ch] text-4xl font-bold leading-tight tracking-[-0.035em] sm:text-5xl">
            {welcomeCopy.welcomeBack.title}
          </h1>
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted">
            {welcomeCopy.welcomeBack.description}
          </p>
        </div>
        {actions}
        <div>
          <button
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand underline decoration-transparent underline-offset-4 hover:decoration-current"
            onClick={() => setShowIntro(true)}
            type="button"
          >
            {welcomeCopy.actions.watchIntro}
          </button>
        </div>
        {showIntro ? <IntroVideo /> : null}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 items-center gap-8 pb-12 pt-2 lg:grid-cols-2 lg:gap-14 lg:pb-20 lg:pt-8">
      <div className="order-1 lg:order-2">
        {isReady ? <IntroVideo /> : <IntroStaticFrame />}
      </div>
      <div className="order-2 flex flex-col gap-7 lg:order-1">
        <div className="space-y-4">
          <h1 className="max-w-[13ch] text-4xl font-bold leading-[1.08] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            {welcomeCopy.headline}
          </h1>
          <p className="max-w-[55ch] text-lg leading-relaxed text-muted sm:text-xl">
            {welcomeCopy.description}
          </p>
        </div>
        <ul className="space-y-4">
          {welcomeCopy.valuePoints.map(({ icon: Icon, label }) => (
            <li className="flex items-center gap-3" key={label}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-selected text-brand">
                <Icon aria-hidden="true" size={22} strokeWidth={2} />
              </span>
              <span className="font-medium text-foreground">{label}</span>
            </li>
          ))}
        </ul>
        {actions}
      </div>
    </section>
  );
}
