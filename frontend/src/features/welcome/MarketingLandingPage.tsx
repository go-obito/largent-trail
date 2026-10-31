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
        © {new Date().getFullYear()} Largent. Made in Ghana.
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
          className="relative isolate flex min-h-[570px] items-center overflow-hidden bg-[#f4f4f0] sm:min-h-[620px]"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(247,247,244,.97) 0%, rgba(247,247,244,.91) 42%, rgba(247,247,244,.58) 72%, rgba(247,247,244,.34) 100%), url("${gridImage}")`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/[0.035]" />
          <div className="relative mx-auto w-full max-w-7xl px-5 py-20 lg:px-10 lg:py-28">
            <div className="max-w-[760px]">
              <h1 id="hero-title" className="text-5xl font-semibold leading-[1.04] tracking-[-0.045em] text-[#171717] sm:text-6xl lg:text-[5.25rem]">
                Your money.
                <br />
                <span className="text-[#315BEA]">More manageable.</span>
              </h1>
              <p className="mt-7 max-w-[590px] text-base leading-7 text-black/70 sm:text-lg sm:leading-8">
                Know what you can spend today, plan for what matters and make better money decisions before it runs out.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  className="inline-flex min-h-12 items-center justify-center gap-3 bg-[#171717] px-6 text-sm font-semibold text-white transition hover:bg-[#315BEA]"
                  href="/sign-up"
                >
                  Get started <ArrowRight size={17} />
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center justify-center border border-black/25 bg-white/55 px-6 text-sm font-semibold text-black transition hover:bg-white"
                  href="/sign-in"
                >
                  I already have an account
                </Link>
              </div>
              <p className="mt-5 text-xs text-black/55">
                Everyday money management, made for real life in Ghana.
              </p>
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
