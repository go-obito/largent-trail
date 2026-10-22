import { PiggyBank, Smartphone, Target } from "lucide-react";

export const welcomeCopy = {
  metadata: {
    title: "Know what you can spend today | Largent",
    description:
      "Largent turns your weekly budget into a simple daily limit. Keep your budgets and goals on track, even offline.",
    imageAlt: "Largent",
  },
  headline: "Know what you can spend today",
  description:
    "Largent turns your weekly budget into a simple daily limit.",
  valuePoints: [
    { icon: Target, label: "Daily spending limit" },
    {
      icon: PiggyBank,
      label: "Budgets and goals that keep you on track",
    },
    {
      icon: Smartphone,
      label: "Works offline, installs like an app",
    },
  ],
  actions: {
    getStarted: "Get started",
    alreadyHaveAccount: "I already have an account",
    signIn: "Sign in",
    createAccount: "Create account",
    watchIntro: "Watch intro",
    back: "Back",
  },
  welcomeBack: {
    title: "Welcome back",
    description: "Your daily money overview is ready when you are.",
  },
  loading: "Loading the welcome page",
  loadingSignIn: "Loading sign-in options",
  loadingSignUp: "Loading account creation",
  video: {
    source: "/Manage%20money%20onboarding%20video.mp4#t=0.001",
    aspectRatio: 1,
    description:
      "An introduction to Largent's daily spending limit, budgets, and offline access.",
    fallbackTitle: "Know what you can spend today",
    fallbackDescription:
      "Largent turns your weekly budget into a simple daily limit.",
    play: "Play intro",
    pause: "Pause intro",
    replay: "Replay",
    playbackError:
      "The intro couldn't play. Try again or continue exploring Largent.",
    playLabel: "Play the Largent introduction",
    pauseLabel: "Pause the Largent introduction",
    replayLabel: "Replay the Largent introduction",
  },
  paths: {
    signIn: "/sign-in?from=welcome",
    signUp: "/sign-up?from=welcome",
    signInPlain: "/sign-in",
    signUpPlain: "/sign-up",
  },
} as const;
