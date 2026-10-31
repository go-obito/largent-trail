import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Heart,
  Wallet,
  Utensils,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const gridImage =
  "https://img.magnific.com/premium-vector/aesthetic-minimal-black-grid-pattern-background_278222-10971.jpg";

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Largent home"
      className="inline-flex items-center gap-2 text-[1.55rem] font-semibold lowercase tracking-[-0.05em]"
      style={{ color: light ? "var(--color-text-on-hero, #fff)" : "var(--color-text-primary)" }}
    >
      <Logo variant="mark" className="size-8" />
      largent
    </Link>
  );
}

function Header() {
  return (
    <header className="relative z-20 border-b bg-page" style={{ borderColor: "var(--color-border)" }}>
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 lg:px-10">
        <Brand />
        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          <Link className="text-sm font-medium text-muted transition hover:text-foreground" href="#features">Features</Link>
          <Link className="text-sm font-medium text-muted transition hover:text-foreground" href="/about">About</Link>
          <Link className="text-sm font-medium text-muted transition hover:text-foreground" href="/install">Install</Link>
          <Link className="text-sm font-medium text-muted transition hover:text-foreground" href="/faqs">FAQs</Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link className="min-h-11 inline-flex items-center px-2 text-sm font-semibold transition hover:text-brand sm:px-3" href="/sign-in">
            Log in
          </Link>
          <Link className="inline-flex min-h-11 items-center gap-2 bg-hero px-4 text-sm font-semibold text-on-hero transition hover:opacity-85 sm:px-5" href="/sign-up">
            Get started <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    icon: Wallet,
    title: "See your money together",
    text: "Keep the balances you choose to record in one clear view, across cash, bank and mobile money.",
  },
  {
    icon: BarChart3,
    title: "Understand daily spending",
    text: "Track what comes in and goes out, then see how your spending changes over time.",
  },
  {
    icon: Utensils,
    title: "Make budgets practical",
    text: "Turn a weekly allowance into a plan you can follow throughout the week.",
  },
  {
    icon: Heart,
    title: "Keep priorities in sight",
    text: "Organise important purchases and follow the progress you make towards them.",
  },
];

function Footer() {
  return (
    <footer className="bg-hero text-on-hero">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Brand light />
          <p className="mt-3 max-w-sm text-sm leading-6 text-on-hero/65">
            A practical space to track your money, plan your spending and make room for what matters.
          </p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-on-hero/75">
          <Link className="transition hover:text-on-hero" href="/about">About</Link>
          <Link className="transition hover:text-on-hero" href="/faqs">FAQs</Link>
          <Link className="transition hover:text-on-hero" href="/install">Install guide</Link>
          <Link className="transition hover:text-on-hero" href="/sign-in">Log in</Link>
        </nav>
      </div>
      <div className="mx-auto max-w-7xl border-t border-on-hero/15 px-5 py-4 text-xs text-on-hero/45 lg:px-10">
        © 2026 Largent. Made in Ghana.
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-page text-foreground">
      <Header />
      <main>
        <section
          aria-labelledby="hero-title"
          className="relative isolate overflow-hidden bg-page"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage: `linear-gradient(90deg, var(--color-background) 0%, color-mix(in srgb, var(--color-background) 94%, transparent) 54%, color-mix(in srgb, var(--color-background) 84%, transparent) 100%), url("${gridImage}")`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
          <div className="relative mx-auto grid min-h-[640px] max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10 lg:px-10 lg:py-24">
            <div className="max-w-[590px]">
              <h1 id="hero-title" className="text-[2.8rem] font-semibold leading-[1.04] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-[4.6rem]">
                Know your money.
                <br />
                <span className="text-brand">Plan what matters.</span>
              </h1>
              <p className="mt-6 max-w-[510px] text-base leading-7 text-muted sm:text-lg sm:leading-8">
                Bring your balances, daily spending, budgets and priorities into one practical view. Make clearer decisions with the money you have.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  className="inline-flex min-h-12 items-center justify-center gap-3 bg-brand px-6 text-sm font-semibold text-on-brand transition hover:bg-brand-hover"
                  href="/sign-up"
                >
                  Get started <ArrowRight size={17} />
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center justify-center border border-outline bg-panel/80 px-6 text-sm font-semibold text-foreground transition hover:bg-panel"
                  href="/sign-in"
                >
                  I already have an account
                </Link>
              </div>
              <p className="mt-5 text-xs font-medium text-muted">
                Everyday money management, made for real life in Ghana.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-[590px] lg:ml-auto">
              <div aria-hidden="true" className="absolute -inset-5 -z-10 rounded-[2rem] bg-brand/10 blur-2xl" />
              <div className="overflow-hidden rounded-2xl border border-outline/70 bg-panel shadow-[0_24px_80px_rgba(17,21,33,0.14)]">
                <div className="flex items-center justify-between border-b border-outline/70 px-5 py-4 sm:px-7">
                  <div className="flex items-center gap-3">
                    <Logo variant="mark" className="size-8" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Your overview</p>
                      <p className="text-xs text-muted">A clearer view of your money</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-[11px] font-semibold text-brand">Preview</span>
                </div>

                <div className="p-4 sm:p-6">
                  <div className="rounded-xl bg-hero p-5 text-on-hero sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-on-hero/70">Total balance</p>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-on-hero/15 px-2.5 py-1 text-[11px] text-on-hero/75">
                        <span className="size-1.5 rounded-full bg-[#7C9AFF]" />
                        Private view
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-4">
                      <p className="text-3xl font-semibold tracking-[0.08em] sm:text-4xl">••••••</p>
                      <span className="text-xs text-on-hero/55">GHS</span>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-3 border-t border-on-hero/15 pt-4">
                      {["Cash", "Bank", "Mobile money"].map((label) => (
                        <div key={label} className="min-w-0">
                          <p className="truncate text-[11px] text-on-hero/55">{label}</p>
                          <p className="mt-1 text-sm font-medium tracking-widest text-on-hero/85">••••</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-outline/70 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Daily spending</p>
                        <BarChart3 className="size-4 text-brand" />
                      </div>
                      <p className="mt-5 text-sm text-muted">Know where your money goes</p>
                      <div className="mt-4 flex h-2 gap-1 overflow-hidden rounded-full bg-brand-soft">
                        <span className="w-[38%] rounded-full bg-brand" />
                        <span className="w-[24%] rounded-full bg-brand/45" />
                        <span className="w-[15%] rounded-full bg-brand/20" />
                      </div>
                    </div>
                    <div className="rounded-xl border border-outline/70 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Your priorities</p>
                        <Heart className="size-4 text-brand" />
                      </div>
                      <p className="mt-5 text-sm text-muted">Keep important plans in sight</p>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="size-2 rounded-full bg-brand" />
                        <span className="h-1.5 flex-1 rounded-full bg-brand-soft" />
                        <span className="size-2 rounded-full bg-brand/35" />
                        <span className="h-1.5 flex-1 rounded-full bg-brand-soft" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-4 hidden items-center gap-3 rounded-xl border border-outline/70 bg-panel px-4 py-3 shadow-lg sm:flex">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Wallet className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">One practical money view</p>
                  <p className="mt-0.5 text-[11px] text-muted">Balances · budgets · priorities</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-b bg-panel" style={{ borderColor: "var(--color-border)" }}>
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-10 lg:py-24">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
                A clearer way to manage everyday money.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted">
                The useful details, in one place. So you can spend with more intention and stay focused on what matters.
              </p>
            </div>
            <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, text }) => (
                <article key={title} className="border-t border-outline pt-5">
                  <Icon aria-hidden="true" className="size-6 text-brand" strokeWidth={1.8} />
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-brand-soft">
          <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-16 sm:flex-row sm:items-center sm:justify-between lg:px-10 lg:py-20">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Start making more intentional money decisions.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted">
                Set up your accounts, record what matters and build a clearer picture one day at a time.
              </p>
            </div>
            <Link
              href="/sign-up"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 bg-hero px-6 text-sm font-semibold text-on-hero transition hover:opacity-85"
            >
              Create your account <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
