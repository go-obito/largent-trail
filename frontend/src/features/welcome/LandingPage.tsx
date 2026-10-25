"use client";

import Button from "@mui/material/Button";
import { ArrowRight, ChartNoAxesCombined, CircleDollarSign, Goal } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { PageContainer } from "@/components/PageContainer";

function authHref(path: "/sign-in" | "/sign-up", redirectUrl?: string) {
  return redirectUrl ? `${path}?redirect_url=${encodeURIComponent(redirectUrl)}` : path;
}

const features = [
  {
    icon: CircleDollarSign,
    title: "Know which days cost the most",
    description:
      "Spot high-spending days in your daily spending view and make decisions before money runs short.",
  },
  {
    icon: Goal,
    title: "Plan your food budget across the week",
    description:
      "Divide your weekly food budget across weekdays and organize essential purchases.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Keep savings goals and spending patterns in view",
    description:
      "Track goal progress and review financial reports to understand your spending habits.",
  },
];

export function LandingPage({ redirectUrl }: { redirectUrl?: string }) {
  const signUpHref = authHref("/sign-up", redirectUrl);
  const signInHref = authHref("/sign-in", redirectUrl);

  return (
    <main className="min-h-dvh bg-page text-foreground">
      <PageContainer>
        <header className="flex min-h-20 items-center justify-between gap-4 py-4">
          <Logo />
          <Button component={Link} href={signInHref} sx={{ minHeight: 44, textTransform: "none" }} variant="text">
            Sign in
          </Button>
        </header>

        <section className="grid items-center gap-10 pb-16 pt-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:pb-24 lg:pt-14">
          <div>
            <h1 className="max-w-[13ch] text-5xl font-bold leading-[1.04] tracking-[-0.04em] sm:text-6xl">
              Make better money decisions before you spend.
            </h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-8 text-muted sm:text-xl">
              Track income and spending, plan your weekly food budget by weekday, and keep essential purchases and savings goals in view.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button component={Link} href={signUpHref} sx={{ minHeight: 52, borderRadius: "14px", textTransform: "none" }} variant="contained">
                Get started <ArrowRight aria-hidden="true" className="ml-2" size={18} />
              </Button>
              <Button component={Link} href={signInHref} sx={{ minHeight: 52, borderRadius: "14px", textTransform: "none" }} variant="outlined">
                Sign in
              </Button>
            </div>
          </div>

          <section aria-label="Illustrative Largent dashboard preview" className="card-surface overflow-hidden p-4 sm:p-6">
            <div className="flex items-center justify-between border-b border-outline pb-4">
              <div><p className="text-sm font-semibold">Your money today</p><p className="mt-1 text-xs text-muted">Illustrative preview — not live account data</p></div>
              <span className="flex size-10 items-center justify-center rounded-xl bg-selected text-brand"><ChartNoAxesCombined aria-hidden="true" size={20} /></span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl bg-[linear-gradient(115deg,color-mix(in_srgb,var(--color-hero)_78%,var(--color-primary)),var(--color-hero))] p-5 text-[var(--color-on-hero)]">
                <p className="text-sm font-medium opacity-80">Total balance</p>
                <p className="money mt-2 text-3xl font-bold tracking-tight">₵4,280.00</p>
                <p className="mt-5 text-sm opacity-80">Across cash, bank, and mobile money</p>
              </div>
              <div className="rounded-2xl bg-selected p-5">
                <p className="text-sm font-semibold">Spend today</p>
                <p className="money mt-2 text-2xl font-bold text-brand">₵86.50</p>
                <p className="mt-2 text-sm leading-5 text-muted">available within your plan</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-panel-raised p-5">
              <div className="flex items-center justify-between gap-4"><span className="font-semibold">Food budget</span><span className="money text-sm font-semibold">₵185 of ₵300</span></div>
              <div aria-hidden="true" className="mt-3 h-2 overflow-hidden rounded-full bg-panel"><div className="h-full w-[62%] rounded-full bg-brand" /></div>
              <div className="mt-4 flex items-center justify-between text-sm"><span className="text-muted">New phone goal</span><span className="font-semibold">₵720 saved</span></div>
            </div>
          </section>
        </section>

        <section aria-labelledby="landing-features" className="border-t border-outline py-14 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <h2 id="landing-features" className="max-w-[18ch] text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Plan the week. Understand your spending. Track your goals.
            </h2>
            <ul className="divide-y divide-outline border-y border-outline">
              {features.map(({ icon: Icon, title, description }) => (
                <li className="flex gap-4 py-5 first:pt-0 last:pb-0" key={title}>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-selected text-brand">
                    <Icon aria-hidden="true" size={22} />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="mt-2 leading-6 text-muted">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </PageContainer>
    </main>
  );
}
