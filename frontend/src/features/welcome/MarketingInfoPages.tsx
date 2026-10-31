import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { ArrowRight, ArrowUpRight, ChevronRight, CircleHelp, Download, Smartphone } from "lucide-react";

const line = "var(--color-border)";

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Largent home"
      className="inline-flex items-center gap-2 text-[1.65rem] font-semibold lowercase tracking-[-0.055em]"
      style={{ color: light ? "var(--color-on-hero)" : "var(--color-text-primary)" }}
    >
      <Logo variant="mark" className="size-8" />
      largent
    </Link>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-page/95 backdrop-blur" style={{ borderColor: line }}>
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-10">
        <Brand />
        <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm font-medium md:flex">
          <Link className="hover:text-brand" href="/">Home</Link>
          <Link className="hover:text-brand" href="/about">About</Link>
          <Link className="hover:text-brand" href="/install">Install</Link>
          <Link className="hover:text-brand" href="/faqs">FAQs</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link className="hidden px-3 py-2 text-sm font-semibold sm:inline-flex" href="/sign-in">Log in</Link>
          <Link className="inline-flex min-h-11 items-center gap-2 bg-hero px-5 text-sm font-semibold text-on-hero transition hover:opacity-85" href="/sign-up">
            Get started <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      <nav aria-label="Mobile navigation" className="flex items-center justify-center gap-7 border-t border-outline px-4 py-3 text-xs font-medium md:hidden">
        <Link href="/">Home</Link><Link href="/about">About</Link><Link href="/install">Install</Link><Link href="/faqs">FAQs</Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-hero py-10 text-on-hero" style={{ borderColor: line }}>
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div>
          <Brand light />
          <p className="mt-3 text-xs text-on-hero/60">Everyday money, made more manageable.</p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-5 text-sm text-on-hero/75">
          <Link href="/">Home</Link><Link href="/about">About</Link><Link href="/install">Install</Link><Link href="/faqs">FAQs</Link>
        </nav>
      </div>
      <div className="mx-auto mt-8 max-w-7xl border-t border-on-hero/15 px-5 pt-5 text-xs text-on-hero/45 lg:px-10">
        © {new Date().getFullYear()} Largent. All rights reserved.
      </div>
    </footer>
  );
}

function PageShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-foreground">
      <Header />
      <main>
        <section className="border-b bg-panel py-16 sm:py-20" style={{ borderColor: line }}>
          <div className="mx-auto max-w-4xl px-5 lg:px-10">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-brand">{eyebrow}</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-.045em] text-foreground sm:text-6xl">{title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted">{description}</p>
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-5 py-14 lg:px-10">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function InfoRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b py-7" style={{ borderColor: line }}>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-muted">{children}</div>
    </section>
  );
}

export function AboutPage() {
  return (
    <PageShell eyebrow="About Largent" title="A more thoughtful way to keep track of everyday money." description="Largent is a personal money-management workspace built around a simple idea: understanding your money should not feel like another complicated task.">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="bg-brand p-7 text-on-brand">
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">The purpose</p>
          <p className="mt-4 text-2xl font-semibold leading-snug">Make the everyday money picture easier to understand.</p>
        </div>
        <div className="border bg-panel p-7" style={{ borderColor: line }}>
          <p className="text-xs font-bold uppercase tracking-widest text-brand">The approach</p>
          <p className="mt-4 text-2xl font-semibold leading-snug text-foreground">Useful tools. Clear information. Your decisions.</p>
        </div>
      </div>
      <InfoRow title="What Largent helps you do">
        <p>Record income and expenses, keep track of accounts and balances, plan budgets, review spending, and keep priority purchases visible. It is designed for personal money tracking, not as a bank or payment service.</p>
      </InfoRow>
      <InfoRow title="Built around real routines">
        <p>Money decisions happen every day. Largent includes practical tools such as daily spending visibility, weekly food budgeting and a priority needs list alongside transaction and account tracking.</p>
      </InfoRow>
      <InfoRow title="Your account and your data">
        <p>You can create an account and sign in to access your Largent information across supported devices. Largent does not connect to your bank or move money on your behalf. Add and maintain the records you want to track.</p>
      </InfoRow>
      <InfoRow title="A web app, not a store download">
        <p>Largent runs in a web browser and can be added to a compatible phone’s Home Screen. There is no separate iOS App Store or Google Play app being offered here.</p>
        <Link className="mt-3 inline-flex items-center gap-2 font-semibold text-brand" href="/install">Read the install guide <ArrowRight size={16} /></Link>
      </InfoRow>
      <div className="mt-10">
        <Link href="/sign-up" className="inline-flex min-h-12 items-center gap-3 bg-hero px-6 text-sm font-semibold text-on-hero">Get started <ArrowUpRight size={16} /></Link>
      </div>
    </PageShell>
  );
}

export function InstallPage() {
  return (
    <PageShell eyebrow="Install Largent" title="Put Largent on your Home Screen." description="Largent is a progressive web app (PWA). You can use it in your browser, or add a shortcut to your phone’s Home Screen for quick access. No app store download is required.">
      <div className="mb-8 flex items-start gap-4 border bg-brand-soft p-5" style={{ borderColor: line }}>
        <Smartphone className="mt-1 shrink-0 text-brand" size={24} />
        <p className="text-sm leading-6 text-muted">Open <strong className="text-foreground">largent.site</strong> in your phone’s browser first. Installation options depend on your device and browser. The steps below describe the standard browser flows.</p>
      </div>
      <InfoRow title="iPhone or iPad — Safari">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Open Safari and visit <strong className="text-foreground">largent.site</strong>.</li>
          <li>Tap the <strong className="text-foreground">Share</strong> button (the square with an upward arrow).</li>
          <li>Scroll the share sheet and choose <strong className="text-foreground">Add to Home Screen</strong>. If it is not visible, scroll to the end or use Edit Actions.</li>
          <li>Confirm the name, then tap <strong className="text-foreground">Add</strong>.</li>
          <li>Find the Largent icon on your Home Screen and open it from there.</li>
        </ol>
        <p className="mt-3">On iOS, use Safari for the most reliable Add to Home Screen flow. Other browsers may offer a different route or hand off to Safari.</p>
      </InfoRow>
      <InfoRow title="Android — Chrome">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Open Chrome and visit <strong className="text-foreground">largent.site</strong>.</li>
          <li>Tap the three-dot menu in the top-right corner.</li>
          <li>Choose <strong className="text-foreground">Install app</strong> or <strong className="text-foreground">Add to Home screen</strong>, depending on the Chrome version and device.</li>
          <li>Follow the confirmation prompt. The Largent icon will be added to your device.</li>
        </ol>
        <p className="mt-3">If Chrome does not show an install option, update the browser and try again. You can still use Largent directly from the browser.</p>
      </InfoRow>
      <InfoRow title="Desktop browsers">
        <p>On supported desktop browsers, look for the install icon in the address bar or choose the browser’s <strong className="text-foreground">Install Largent</strong> option from its menu. Availability varies by browser and operating system.</p>
      </InfoRow>
      <InfoRow title="What installation does — and does not do">
        <p>Installing adds a Home Screen or desktop entry and opens Largent in an app-like window where supported. It does not download a separate native app from an app store, and it does not create a new account. Sign in with your existing account to access your saved Largent information.</p>
      </InfoRow>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/sign-up" className="inline-flex min-h-12 items-center gap-2 bg-brand px-6 text-sm font-semibold text-on-brand">Create an account <ArrowRight size={16} /></Link>
        <Link href="/faqs" className="inline-flex min-h-12 items-center gap-2 border border-outline px-6 text-sm font-semibold text-foreground hover:bg-panel">Read FAQs <CircleHelp size={16} /></Link>
      </div>
    </PageShell>
  );
}

const faqs = [
  { q: "What is Largent?", a: "Largent is a personal money-management web app for recording transactions, tracking accounts, planning budgets and reviewing spending." },
  { q: "Is Largent a mobile app?", a: "Largent is a progressive web app. It runs in a browser and can be added to a compatible phone’s Home Screen. It is not currently a native App Store or Google Play download." },
  { q: "How do I add Largent to my Home Screen?", a: "On iPhone or iPad, open largent.site in Safari, tap Share, then choose Add to Home Screen. On Android, open the site in Chrome, open the three-dot menu and choose Install app or Add to Home screen. See the Install page for detailed steps." },
  { q: "Do I need an account?", a: "You can browse the public information without signing in. To use your personal Largent workspace and keep your records associated with your account across supported devices, create an account and sign in." },
  { q: "Does Largent connect to my bank or Mobile Money account?", a: "No. Largent does not currently connect to bank or Mobile Money accounts and does not automatically fetch transactions. You record the information you want to track." },
  { q: "Can I use Largent on more than one device?", a: "Yes. Sign in to the same Largent account on another supported device to access your account information." },
  { q: "What can I track with Largent?", a: "You can record income and expenses, manage accounts and balances, create budgets, review spending and organize priority needs." },
  { q: "Does Largent move or store my money?", a: "No. Largent is a tracking and planning tool. It does not hold funds, make payments or transfer money." },
  { q: "Is Largent free?", a: "Check the current sign-up experience for the latest access and pricing information. This page does not promise a price or plan that may change." },
  { q: "What if I cannot install it?", a: "You can continue using Largent at largent.site in your browser. Installation is optional and browser support varies." },
];

export function FaqsPage() {
  return (
    <PageShell eyebrow="Help and answers" title="Frequently asked questions." description="Straight answers about what Largent does, how accounts work and how to use it on your phone.">
      <div className="divide-y border-y" style={{ borderColor: line }}>
        {faqs.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-foreground marker:hidden">
              {item.q}<ChevronRight className="shrink-0 text-brand transition-transform group-open:rotate-90" size={19} />
            </summary>
            <p className="max-w-3xl pt-4 pr-8 text-sm leading-7 text-muted">{item.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-10 border bg-brand-soft p-6 sm:p-8" style={{ borderColor: line }}>
        <h2 className="text-xl font-semibold text-foreground">Still getting started?</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Visit the install guide or create an account to explore Largent.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/install" className="inline-flex min-h-11 items-center gap-2 bg-brand px-5 text-sm font-semibold text-on-brand">Install guide <Download size={16} /></Link>
          <Link href="/sign-up" className="inline-flex min-h-11 items-center gap-2 border border-outline px-5 text-sm font-semibold text-foreground hover:bg-panel">Get started <ArrowRight size={16} /></Link>
        </div>
      </div>
    </PageShell>
  );
}
