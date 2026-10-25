'use client';

/**
 * Largent landing page — built from Largent_Finance_App_Landing_Page.png
 *
 * Rendered for signed-out users by `src/app/page.tsx`.
 *
 * Notes
 * - Tailwind utilities only for layout/styling; icons from the existing lucide-react dependency.
 * - Colours live in `C` below. Swap each value for the matching token from
 *   `src/styles/palette.ts` (or a CSS var from tokens.css) so this page follows the theme.
 * - All GHS figures in the mockups are static marketing copy, not live data, so they are
 *   plain strings on purpose (formatGhs is for real money values).
 * - Edit ROUTES to match your existing route paths.
 */

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  Camera,
  ChartColumn,
  ChartPie,
  CheckCircle,
  ChevronRight,
  CirclePlay,
  CloudUpload,
  GraduationCap,
  House,
  Lightbulb,
  PiggyBank,
  ReceiptText,
  Send,
  Star,
  TrendingUp,
  UserRound,
  Wallet,
  Zap,
  Trophy,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const ROUTES = {
  signUp: '/sign-up',
  signIn: '/sign-in',
  home: '/',
};

// Replace with palette.ts tokens.
const C = {
  primary: '#1B6BFF',
  primaryDark: '#0E3FB5',
  primarySoft: '#EAF1FF',
  ink: '#0F172A',
  body: '#475569',
  muted: '#94A3B8',
  line: '#E6ECF5',
  bg: '#F6F9FF',
  navy: '#0A1B4D',
  green: '#22A06B',
  greenSoft: '#E4F7EE',
  red: '#EF5350',
  orange: '#F59E0B',
  purple: '#8B6CF0',
};

const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Screens', href: '#screens' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'FAQ', href: '#faq' },
];

/* -------------------------------------------------------------------------- */
/* Small shared pieces                                                        */
/* -------------------------------------------------------------------------- */

const serif = { fontFamily: 'var(--font-display, "Fraunces", "Playfair Display", Georgia, serif)' };

function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${className}`}
      style={{ color: C.primary }}
    >
      {children}
    </p>
  );
}

function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(27,107,255,0.7)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ background: C.primary, outlineColor: C.primary }}
    >
      {children}
    </Link>
  );
}

function GhostButton({
  href,
  children,
  dark = false,
}: {
  href: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold transition hover:bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={
        dark
          ? { borderColor: 'rgba(255,255,255,0.35)', color: '#fff', outlineColor: '#fff' }
          : { borderColor: C.line, color: C.ink, background: '#fff', outlineColor: C.primary }
      }
    >
      <CirclePlay size={18} />
      {children}
    </Link>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href={ROUTES.home} className="flex items-center gap-2" aria-label="Largent home">
      <svg width="26" height="22" viewBox="0 0 26 22" fill="none" aria-hidden>
        <path
          d="M7 21a6 6 0 0 1-.5-12A8 8 0 0 1 22 8.5 5.5 5.5 0 0 1 20 21H7Z"
          fill={C.primary}
        />
        <path d="M9 15l4-4 3 3 4-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-bold" style={{ color: light ? '#fff' : C.ink }}>
        Largent
      </span>
    </Link>
  );
}

function IconTile({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white"
      style={{ background: color }}
    >
      {children}
    </span>
  );
}

function SoftIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      style={{ background: C.primarySoft, color: C.primary }}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Device mockups (pure markup, no images)                                    */
/* -------------------------------------------------------------------------- */

const WEEK_BARS = [62, 48, 70, 40, 78, 55, 66];

function LaptopMock({ className = '' }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <div
        className="rounded-t-2xl border-[6px] bg-white"
        style={{ borderColor: '#1E293B', boxShadow: '0 30px 60px -25px rgba(15,23,42,0.45)' }}
      >
        <div className="flex">
          {/* sidebar */}
          <div className="hidden w-[22%] border-r p-3 sm:block" style={{ borderColor: C.line }}>
            <Logo />
            <ul className="mt-4 space-y-2 text-[10px]" style={{ color: C.body }}>
              {['Home', 'Transactions', 'Budgets', 'Reports', 'Goals', 'Profile'].map((l, i) => (
                <li
                  key={l}
                  className="rounded-md px-2 py-1.5"
                  style={i === 0 ? { background: C.primarySoft, color: C.primary, fontWeight: 600 } : {}}
                >
                  {l}
                </li>
              ))}
            </ul>
          </div>
          {/* content */}
          <div className="flex-1 p-3 sm:p-4">
            <p className="text-xs font-semibold" style={{ color: C.ink }}>
              Overview
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-2" style={{ borderColor: C.line }}>
                <p className="text-[8px]" style={{ color: C.muted }}>
                  Total balance
                </p>
                <p className="text-sm font-bold" style={{ color: C.ink }}>
                  GHS 2,540.00
                </p>
                <p className="text-[8px]" style={{ color: C.green }}>
                  +2.4% this week
                </p>
              </div>
              <div className="flex items-center justify-center rounded-lg border" style={{ borderColor: C.line }}>
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: C.greenSoft, color: C.green }}
                >
                  <PiggyBank size={18} />
                </span>
              </div>
            </div>
            <div className="mt-2 rounded-lg border p-2" style={{ borderColor: C.line }}>
              <p className="text-[9px] font-semibold" style={{ color: C.ink }}>
                Spending this week
              </p>
              <div className="mt-2 flex h-16 items-end gap-2">
                {WEEK_BARS.map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{ height: `${h}%`, background: C.primary }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-2 rounded-lg border p-2" style={{ borderColor: C.line }}>
              <p className="text-[9px] font-semibold" style={{ color: C.ink }}>
                Budgets
              </p>
              <div className="mt-1 h-1.5 rounded-full" style={{ background: C.line }}>
                <div className="h-full w-3/5 rounded-full" style={{ background: C.primary }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto h-2 w-[104%] -translate-x-[2%] rounded-b-xl" style={{ background: '#CBD5E1' }} />
    </div>
  );
}

const TX = [
  { name: 'Bolt Food', cat: 'Food', amt: '- GHS 45.00', when: 'Today 12:30', color: '#16A34A', out: true },
  { name: 'MTN', cat: 'Transport', amt: '- GHS 14.00', when: 'Today 08:10', color: '#FACC15', out: true },
  { name: 'Salary', cat: 'Income', amt: '+ GHS 800.00', when: 'Oct 20', color: C.primary, out: false },
  { name: 'Amazon', cat: 'Shopping', amt: '- GHS 120.00', when: 'Oct 19', color: '#111827', out: true },
];

function PhoneMock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[2.2rem] border-[7px] bg-white ${className}`}
      style={{ borderColor: '#0B1220', boxShadow: '0 40px 70px -30px rgba(15,23,42,0.55)' }}
      aria-hidden
    >
      <div className="mx-auto mt-1 h-4 w-20 rounded-full" style={{ background: '#0B1220' }} />
      <div className="px-3 pb-3 pt-2">
        <div
          className="rounded-xl p-3 text-white"
          style={{ background: `linear-gradient(135deg, ${C.primaryDark}, ${C.primary})` }}
        >
          <p className="text-[8px] opacity-80">Total balance</p>
          <p className="text-lg font-bold leading-tight">GHS 2,540.00</p>
          <span className="mt-1 inline-block rounded-full bg-white/20 px-1.5 py-0.5 text-[8px]">
            +2.4% this week
          </span>
        </div>
        <div className="mt-3 flex justify-around text-center text-[8px]" style={{ color: C.body }}>
          {['Add', 'Transfer', 'More'].map((l, i) => (
            <div key={l}>
              <span
                className="mx-auto mb-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
                style={i === 0 ? { background: C.primary, color: '#fff' } : { background: C.primarySoft, color: C.primary }}
              >
                {i === 0 ? '+' : i === 1 ? '⇄' : '•••'}
              </span>
              {l}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[9px] font-semibold" style={{ color: C.ink }}>
          Recent transactions
        </p>
        <ul className="mt-1.5 space-y-2">
          {TX.map((t) => (
            <li key={t.name} className="flex items-center gap-2">
              <span className="h-6 w-6 shrink-0 rounded-md" style={{ background: t.color }} />
              <span className="flex-1 leading-tight">
                <span className="block text-[9px] font-semibold" style={{ color: C.ink }}>
                  {t.name}
                </span>
                <span className="block text-[7px]" style={{ color: C.muted }}>
                  {t.cat}
                </span>
              </span>
              <span className="text-right leading-tight">
                <span className="block text-[9px] font-semibold" style={{ color: t.out ? C.red : C.green }}>
                  {t.amt}
                </span>
                <span className="block text-[7px]" style={{ color: C.muted }}>
                  {t.when}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

function Navbar() {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ background: 'rgba(255,255,255,0.85)', borderColor: C.line }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-xs font-medium hover:underline" style={{ color: C.body }}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link href={ROUTES.signIn} className="text-xs font-medium" style={{ color: C.ink }}>
            Sign in
          </Link>
          <Link
            href={ROUTES.signUp}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
            style={{ background: C.primary }}
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const chips = [
    { icon: <ReceiptText size={18} />, text: 'Track expenses and income' },
    { icon: <Wallet size={18} />, text: 'Plan and stick to your budget' },
    { icon: <PiggyBank size={18} />, text: 'Reach your savings goals' },
  ];
  return (
    <section className="overflow-hidden" style={{ background: `linear-gradient(180deg, #fff 0%, ${C.bg} 100%)` }}>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
            style={{ background: C.primarySoft, color: C.primary }}
          >
            <Zap size={13} /> Take control of your money
          </span>
          <h1
            className="mt-5 text-5xl font-semibold leading-[1.02] sm:text-6xl"
            style={{ ...serif, color: C.ink, letterSpacing: '-0.02em' }}
          >
            Track. Plan.
            <br />
            Save. <span style={{ color: C.primary }}>Grow.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed" style={{ color: C.body }}>
            Largent is a simple and powerful personal finance tracker that helps you understand your spending,
            stick to your budget, and build better money habits.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <PrimaryButton href={ROUTES.signUp}>
              Get started <ArrowRight size={18} />
            </PrimaryButton>
            <GhostButton href="#how-it-works">See how it works</GhostButton>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {chips.map((c) => (
              <li key={c.text} className="flex items-center gap-2.5">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-white"
                  style={{ borderColor: C.line, color: C.primary }}
                >
                  {c.icon}
                </span>
                <span className="text-[11px] leading-snug" style={{ color: C.body }}>
                  {c.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* devices */}
        <div className="relative mx-auto h-[420px] w-full max-w-[560px] sm:h-[480px]">
          <LaptopMock className="absolute right-[-12%] top-6 w-[88%]" />
          <PhoneMock className="absolute left-[6%] top-0 w-[44%] min-w-[190px]" />
        </div>
      </div>
    </section>
  );
}

function Audience() {
  const items = [
    { icon: <GraduationCap />, title: 'Students', text: 'Manage limited income' },
    { icon: <BriefcaseBusiness />, title: 'Young professionals', text: 'Stay on top of spending' },
    { icon: <House />, title: 'Households', text: 'Plan and save together' },
    { icon: <Star />, title: 'Anyone', text: 'Build better money habits' },
  ];
  return (
    <section className="bg-white py-14">
      <div className="mx-auto max-w-6xl px-5 text-center">
        <Eyebrow>Built for real life</Eyebrow>
        <p className="mt-2 text-sm" style={{ color: C.body }}>
          A modern finance tracker for everyday people
        </p>
        <ul className="mt-9 grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-4">
          {items.map((i) => (
            <li key={i.title} className="flex items-center gap-3">
              <span style={{ color: C.ink }}>{i.icon}</span>
              <span>
                <span className="block text-xs font-semibold" style={{ color: C.ink }}>
                  {i.title}
                </span>
                <span className="block text-[11px]" style={{ color: C.body }}>
                  {i.text}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      color: C.primary,
      icon: <ReceiptText />,
      title: 'Track transactions',
      text: 'Log expenses and income manually or import from statements.',
    },
    {
      color: C.green,
      icon: <Wallet />,
      title: 'Set budgets',
      text: 'Create weekly or monthly budgets and get notified before you overspend.',
    },
    {
      color: C.orange,
      icon: <ChartPie />,
      title: 'Analyze spending',
      text: 'Beautiful reports to help you understand where your money goes.',
    },
    {
      color: C.purple,
      icon: <Trophy />,
      title: 'Set goals',
      text: 'Save for what matters with flexible savings goals and challenges.',
    },
  ];
  return (
    <section id="features" className="py-16" style={{ background: C.bg }}>
      <div className="mx-auto max-w-6xl px-5 text-center">
        <Eyebrow>Key features</Eyebrow>
        <h2 className="mt-2 text-3xl font-semibold" style={{ ...serif, color: C.ink }}>
          Everything you need to manage your money
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: C.body }}>
          Powerful features, simple design. Largent helps you take control of your finances without the complexity.
        </p>
        <ul className="mt-10 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
          {items.map((f) => (
            <li
              key={f.title}
              className="rounded-2xl border bg-white p-6"
              style={{ borderColor: C.line, boxShadow: '0 12px 30px -22px rgba(15,23,42,0.35)' }}
            >
              <IconTile color={f.color}>{f.icon}</IconTile>
              <h3 className="mt-5 text-sm font-semibold" style={{ color: C.ink }}>
                {f.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: C.body }}>
                {f.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const DONUT = [
  { label: 'Food', pct: 38, color: '#3B6EF5' },
  { label: 'Transport', pct: 22, color: '#F0605A' },
  { label: 'Shopping', pct: 15, color: '#F5A340' },
  { label: 'Bills', pct: 12, color: '#58C98B' },
  { label: 'Others', pct: 13, color: '#BCD3FA' },
];

function conic() {
  let acc = 0;
  return `conic-gradient(${DONUT.map((d) => {
    const start = acc;
    acc += d.pct;
    return `${d.color} ${start}% ${acc}%`;
  }).join(', ')})`;
}

const FOOD_DAYS = [
  { d: 'Mon', h: 88, c: '#4FD1C5' },
  { d: 'Tue', h: 60, c: '#2BB5C9' },
  { d: 'Wed', h: 52, c: '#5B9BE8' },
  { d: 'Thu', h: 70, c: '#5B9BE8' },
  { d: 'Fri', h: 32, c: '#4FD1C5' },
  { d: 'Sat', h: 48, c: '#4FD1C5' },
  { d: 'Sun', h: 66, c: '#F0705F' },
];

function Insights() {
  const points = [
    { icon: <ChartColumn />, title: 'Spending breakdowns', text: 'See exactly where your money goes.' },
    { icon: <TrendingUp />, title: 'Weekly and monthly reports', text: 'Track trends and compare periods.' },
    { icon: <Lightbulb />, title: 'Personalized insights', text: 'Get helpful tips based on your spending habits.' },
  ];
  return (
    <section id="screens" className="py-20" style={{ background: `linear-gradient(180deg, ${C.bg}, #EEF4FF)` }}>
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
        {/* cards */}
        <div className="relative mx-auto h-[420px] w-full max-w-[460px]" aria-hidden>
          <div className="absolute left-0 top-0 w-[78%] rounded-2xl bg-white p-5 shadow-[0_20px_50px_-25px_rgba(15,23,42,0.4)]">
            <p className="text-xs font-semibold" style={{ color: C.ink }}>
              Spending by category
            </p>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-32 w-32 shrink-0 rounded-full" style={{ background: conic() }}>
                <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-[8px]" style={{ color: C.muted }}>
                    GHS
                  </span>
                  <span className="text-xl font-bold leading-none" style={{ color: C.ink }}>
                    620
                  </span>
                  <span className="text-[8px]" style={{ color: C.muted }}>
                    This week
                  </span>
                </div>
              </div>
              <ul className="flex-1 space-y-1.5 text-[10px]">
                {DONUT.map((d) => (
                  <li key={d.label} className="flex items-center gap-1.5" style={{ color: C.body }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1">{d.label}</span>
                    <span className="font-semibold" style={{ color: C.ink }}>
                      {d.pct}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="absolute bottom-0 left-[-4%] w-[66%] rounded-2xl bg-white p-4 shadow-[0_20px_50px_-25px_rgba(15,23,42,0.4)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: C.ink }}>
                Weekly food budget
              </p>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-sm" style={{ color: C.ink }}>
                GHS 50 <span style={{ color: C.muted }}>/ day</span>
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{ background: C.greenSoft, color: C.green }}
              >
                On track
              </span>
            </div>
            <div className="mt-3 flex h-24 items-end gap-2">
              {FOOD_DAYS.map((b) => (
                <div key={b.d} className="flex flex-1 flex-col items-center gap-1">
                  <span className="w-full rounded-sm" style={{ height: `${b.h}%`, background: b.c }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-2 text-[8px]" style={{ color: C.muted }}>
              {FOOD_DAYS.map((b) => (
                <span key={b.d} className="flex-1 text-center">
                  {b.d}
                </span>
              ))}
            </div>
          </div>

          <div className="absolute bottom-[26%] right-0 w-[52%] rounded-2xl bg-white p-4 shadow-[0_20px_50px_-25px_rgba(15,23,42,0.4)]">
            <p className="text-xs font-semibold" style={{ color: C.ink }}>
              Savings goal
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: C.greenSoft, color: C.green }}
              >
                <PiggyBank size={18} />
              </span>
              <span className="leading-tight">
                <span className="block text-[10px] font-semibold" style={{ color: C.ink }}>
                  New Laptop
                </span>
                <span className="block text-[9px]" style={{ color: C.body }}>
                  GHS 600 / 1,200
                </span>
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full" style={{ background: C.line }}>
                <div className="h-full w-1/2 rounded-full" style={{ background: C.primary }} />
              </div>
              <span className="text-[9px] font-semibold" style={{ color: C.ink }}>
                50%
              </span>
            </div>
          </div>
        </div>

        {/* copy */}
        <div>
          <Eyebrow>Turn data into insights</Eyebrow>
          <h2 className="mt-2 text-4xl font-semibold leading-tight" style={{ ...serif, color: C.ink }}>
            Understand your spending, at a glance
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: C.body }}>
            Clear reports and smart insights help you see where your money goes, identify spending patterns, and
            make better decisions.
          </p>
          <ul className="mt-7 space-y-5">
            {points.map((p) => (
              <li key={p.title} className="flex items-center gap-4">
                <SoftIcon>{p.icon}</SoftIcon>
                <span>
                  <span className="block text-sm font-semibold" style={{ color: C.ink }}>
                    {p.title}
                  </span>
                  <span className="block text-xs" style={{ color: C.body }}>
                    {p.text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function StoreBadge({ store }: { store: 'apple' | 'google' }) {
  const apple = store === 'apple';
  return (
    <span
      className="inline-flex items-center gap-2.5 rounded-lg px-4 py-2 text-white"
      style={{ background: '#000' }}
      aria-label={apple ? 'Download on the App Store (coming soon)' : 'Get it on Google Play (coming soon)'}
    >
      <span className="text-xl leading-none" aria-hidden>
        {apple ? '' : '▶'}
      </span>
      <span className="leading-tight">
        <span className="block text-[8px] uppercase opacity-80">{apple ? 'Download on the' : 'Get it on'}</span>
        <span className="block text-sm font-semibold">{apple ? 'App Store' : 'Google Play'}</span>
      </span>
    </span>
  );
}

function Devices() {
  return (
    <section className="overflow-hidden bg-white py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Eyebrow>Your money, everywhere</Eyebrow>
          <h2 className="mt-2 text-4xl font-semibold leading-tight" style={{ ...serif, color: C.ink }}>
            A seamless experience on all your devices
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: C.body }}>
            Use Largent on web or mobile. Your data stays in sync so you can manage your money anytime, anywhere.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <StoreBadge store="apple" />
            <StoreBadge store="google" />
          </div>
        </div>
        <div className="relative mx-auto h-[330px] w-full max-w-[560px]">
          <LaptopMock className="absolute left-0 top-4 w-[82%]" />
          <PhoneMock className="absolute bottom-0 right-0 w-[32%] min-w-[130px]" />
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: <UserRound />, title: '1. Create your account', text: 'Sign up in seconds and set up your profile.' },
    { icon: <ReceiptText />, title: '2. Track your money', text: 'Add your transactions or import from a statement.' },
    { icon: <CloudUpload />, title: '3. Get insights', text: 'See reports, set budgets, and reach your goals.' },
  ];
  return (
    <section id="how-it-works" className="py-16" style={{ background: C.bg }}>
      <div className="mx-auto max-w-6xl px-5 text-center">
        <Eyebrow>Get started in minutes</Eyebrow>
        <h2 className="mt-2 text-3xl font-semibold" style={{ ...serif, color: C.ink }}>
          How Largent works
        </h2>
        <p className="mt-3 text-sm" style={{ color: C.body }}>
          A simple process to take control of your finances.
        </p>
        <ol className="mt-10 grid items-start gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex flex-col items-center">
              <SoftIcon>{s.icon}</SoftIcon>
              <h3 className="mt-4 text-sm font-semibold" style={{ color: C.ink }}>
                {s.title}
              </h3>
              <p className="mt-2 max-w-[220px] text-xs leading-relaxed" style={{ color: C.body }}>
                {s.text}
              </p>
              {i < steps.length - 1 && (
                <ChevronRight
                  className="absolute right-[-14%] top-3 hidden md:block"
                  size={14}
                  color={C.muted}
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const REVIEWS = [
  {
    quote: 'Largent has completely changed how I manage my money. The reports are super helpful!',
    name: 'Ama K.',
    role: 'Student',
    tone: '#C77D5B',
  },
  {
    quote: 'I love the budget and weekly food plan feature. It keeps me on track every week.',
    name: 'Kwame T.',
    role: 'Young Professional',
    tone: '#5B7FC7',
  },
  {
    quote: 'Simple, clean and powerful. Exactly what I needed.',
    name: 'Esi M.',
    role: 'Freelancer',
    tone: '#8B5E3C',
  },
];

function Reviews() {
  return (
    <section id="reviews" className="py-16" style={{ background: '#EEF4FF' }}>
      <div className="mx-auto max-w-6xl px-5 text-center">
        <Eyebrow>What users say</Eyebrow>
        <h2 className="mt-2 text-3xl font-semibold" style={{ ...serif, color: C.ink }}>
          Helping people build better money habits
        </h2>
        <ul className="mt-10 grid gap-5 text-left md:grid-cols-3">
          {REVIEWS.map((r) => (
            <li key={r.name} className="rounded-2xl border bg-white p-6" style={{ borderColor: C.line }}>
              <p className="text-sm leading-relaxed" style={{ color: C.ink }}>
                “{r.quote}”
              </p>
              <div className="mt-5 flex items-center gap-3">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: r.tone }}
                  aria-hidden
                >
                  {r.name[0]}
                </span>
                <span className="flex-1 leading-tight">
                  <span className="block text-xs font-semibold" style={{ color: C.ink }}>
                    {r.name}
                  </span>
                  <span className="block text-[11px]" style={{ color: C.muted }}>
                    {r.role}
                  </span>
                </span>
                <span className="flex" aria-label="5 out of 5 stars">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={14} color={C.orange} />
                  ))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section
      id="faq"
      className="py-16 text-center"
      style={{ background: `radial-gradient(120% 140% at 50% 0%, #17398F 0%, ${C.navy} 60%)` }}
    >
      <div className="mx-auto max-w-3xl px-5">
        <Eyebrow className="!text-[#7FB0FF]">Ready to take control?</Eyebrow>
        <h2 className="mt-2 text-4xl font-semibold text-white" style={serif}>
          Start your financial journey today
        </h2>
        <p className="mt-3 text-sm" style={{ color: '#C7D6F5' }}>
          Join thousands of people who are managing their money better with Largent.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <PrimaryButton href={ROUTES.signUp}>
            Get started <ArrowRight size={18} />
          </PrimaryButton>
          <GhostButton href="#how-it-works" dark>
            See how it works
          </GhostButton>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO: wire to your newsletter endpoint when it exists.
    if (email.trim()) setDone(true);
  }

  const cols = [
    { title: 'Product', links: ['Features', 'Pricing', 'Security', 'Changelog'] },
    { title: 'Company', links: ['About', 'Blog', 'Contact', 'Careers'] },
    { title: 'Support', links: ['Help Center', 'Privacy Policy', 'Terms of Service'] },
  ];

  return (
    <footer className="bg-white pt-12" style={{ borderTop: `1px solid ${C.line}` }}>
      <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.6fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-[200px] text-[11px] leading-relaxed" style={{ color: C.body }}>
            A simpler way to manage your money. Track. Plan. Save. Grow.
          </p>
          <div className="mt-4 flex gap-3" style={{ color: C.ink }}>
            <Send size={18} aria-label="Twitter" />
            <Camera size={18} aria-label="Instagram" />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label="TikTok">
              <path d="M16.6 3a5.2 5.2 0 0 0 4.1 4.6v3.2a8.3 8.3 0 0 1-4-1.1v6.1a6.3 6.3 0 1 1-6.3-6.3c.3 0 .6 0 .9.1v3.3a3 3 0 1 0 2.1 2.9V3h3.2Z" />
            </svg>
            <CirclePlay size={18} aria-label="YouTube" />
          </div>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-xs font-semibold" style={{ color: C.ink }}>
              {c.title}
            </p>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l}>
                  <a href="#" className="text-[11px] hover:underline" style={{ color: C.body }}>
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div>
          <p className="text-xs font-semibold" style={{ color: C.ink }}>
            Subscribe to updates
          </p>
          <p className="mt-2 text-[11px]" style={{ color: C.body }}>
            Get the latest news and features.
          </p>
          {done ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium" style={{ color: C.green }}>
              <CheckCircle size={18} /> You’re on the list.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-3 flex overflow-hidden rounded-lg border" style={{ borderColor: C.line }}>
              <label htmlFor="landing-email" className="sr-only">
                Email address
              </label>
              <input
                id="landing-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="min-w-0 flex-1 px-3 py-2 text-xs outline-none"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="px-3 text-white"
                style={{ background: C.primary }}
              >
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </div>
      </div>
      <div
        className="mx-auto mt-10 flex max-w-6xl items-center justify-between px-5 py-5 text-[11px]"
        style={{ color: C.body, borderTop: `1px solid ${C.line}` }}
      >
        <span>© {new Date().getFullYear()} Largent. All rights reserved.</span>
        <span className="flex items-center gap-1.5">
          Made in Ghana
          <span
            aria-hidden
            className="inline-block h-3 w-4 rounded-[2px]"
            style={{ background: 'linear-gradient(#CE1126 33%, #FCD116 33% 66%, #006B3F 66%)' }}
          />
        </span>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ color: C.ink }}>
      <Navbar />
      <main>
        <Hero />
        <Audience />
        <Features />
        <Insights />
        <Devices />
        <HowItWorks />
        <Reviews />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
