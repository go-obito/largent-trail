import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import {
  ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight, CircleHelp,
  Download, Heart, ListChecks, Menu, Smartphone, Wallet, Utensils,
} from "lucide-react";

const ink = "var(--color-text-primary)";
const blue = "var(--color-primary)";
const muted = "var(--color-text-secondary)";
const line = "var(--color-border)";

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" aria-label="Largent home" className="inline-flex items-center gap-2 text-[1.65rem] font-semibold lowercase tracking-[-0.055em]" style={{ color: light ? "var(--color-text-on-hero, #fff)" : "var(--color-text-primary)" }}><Logo variant="mark" className="size-8" />largent</Link>;
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-page/95 backdrop-blur" style={{borderColor:line}}>
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-10">
        <Brand />
        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          <Link className="text-sm font-medium hover:text-brand" href="#features">Features</Link>
          <Link className="text-sm font-medium hover:text-blue-700" href="/about">About</Link>
          <Link className="text-sm font-medium hover:text-blue-700" href="/install">Install</Link>
          <Link className="text-sm font-medium hover:text-blue-700" href="/faqs">FAQs</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link className="hidden px-3 py-2 text-sm font-semibold sm:inline-flex" href="/sign-in">Log in</Link>
          <Link className="inline-flex min-h-11 items-center gap-2 bg-hero px-5 text-sm font-semibold text-on-hero transition hover:bg-hero/85" href="/sign-up">
            Get started <ArrowUpRight size={16}/>
          </Link>
        </div>
      </div>
      <nav aria-label="Mobile navigation" className="flex items-center justify-center gap-7 border-t border-outline px-4 py-3 text-xs font-medium md:hidden">
        <Link href="#features">Features</Link><Link href="/about">About</Link><Link href="/install">Install</Link><Link href="/faqs">FAQs</Link>
      </nav>
    </header>
  );
}

function HeroArtwork() {
  return (
    <div className="relative mx-auto min-h-[430px] w-full max-w-[660px] sm:min-h-[540px]" aria-label="Largent money overview interface over a monochrome geometric grid" role="img">
      <div className="absolute inset-[3%_2%_5%_8%] overflow-hidden bg-[#f7f7f4]"><div className="absolute inset-0 bg-[url('/largent-grid.svg')] bg-cover bg-center opacity-95" /></div>
      <div className="absolute left-[3%] top-[8%] z-10 border border-black/15 bg-white px-4 py-3 shadow-lg"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-black/50">A clearer view</p><p className="mt-1 text-sm font-semibold text-black">Money, with direction.</p></div>
      <div className="absolute right-[5%] top-[13%] z-10 w-[76%] border border-black/15 bg-white p-4 shadow-[0_28px_70px_-34px_rgba(0,0,0,.5)] sm:right-[8%] sm:w-[72%] sm:p-6">
        <div className="flex items-center justify-between border-b border-black/10 pb-4"><div><div className="text-xs font-semibold text-black">Your money overview</div><div className="mt-1 text-[10px] text-black/50">A little more clarity, every day</div></div><span className="bg-[#315BEA] px-2 py-1 text-[9px] font-bold tracking-wider text-white">LARGENT</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3"><div className="bg-[#171717] p-3 text-white sm:p-4"><div className="text-[9px] text-white/65">Account balance</div><div className="mt-2 text-lg font-bold sm:text-2xl">GHS 4,280</div><div className="mt-3 text-[9px] text-white/60">Across your accounts</div></div><div className="border border-black/10 p-3 sm:p-4"><div className="text-[9px] text-black/50">Daily spending</div><div className="mt-2 text-sm font-bold text-black sm:text-lg">Stay on track</div><div className="mt-3 h-1.5 bg-black/10"><div className="h-full w-2/3 bg-[#315BEA]"/></div><div className="mt-2 text-[9px] text-black/45">Your daily target</div></div></div>
        <div className="mt-3 border border-black/10 p-3 sm:mt-4 sm:p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-black sm:text-xs">Spending through the week</span><span className="text-[9px] text-black/45">This week</span></div><div className="mt-4 flex h-16 items-end gap-2 sm:h-20">{[38,62,48,82,56,72,42].map((h,i)=><span key={i} className="flex-1" style={{height: h + "%",background:i===3?"#315BEA":"#D5D5D2"}}/>)}</div><div className="mt-2 flex justify-between text-[8px] text-black/40"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div></div>
      </div>
      <div className="absolute bottom-[5%] left-[2%] z-20 w-[35%] border-[6px] border-[#171717] bg-white p-2 shadow-xl sm:w-[32%] sm:border-[8px] sm:p-3"><div className="mx-auto mb-2 h-1 w-8 bg-black"/><div className="bg-[#315BEA] p-3 text-white"><div className="text-[8px] text-white/70">PRIORITY NEEDS</div><div className="mt-2 text-xs font-bold sm:text-sm">What matters next</div><div className="mt-3 h-1 bg-white/30"><div className="h-1 w-3/5 bg-white"/></div></div><div className="mt-3 space-y-2"><div className="h-1.5 w-4/5 bg-black/10"/><div className="h-1.5 w-3/5 bg-black/10"/></div></div>
      <div className="absolute bottom-[12%] right-[1%] z-20 bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-black shadow-lg sm:px-4 sm:py-3 sm:text-[10px]">Plan with intention <span className="ml-2 text-[#315BEA]">↗</span></div>
    </div>
  );
}
const features = [
  {icon:Wallet,title:"See your accounts together",text:"Keep track of the balances you choose to record, with a clear view of your accounts."},
  {icon:BarChart3,title:"Understand your spending",text:"Record transactions and review spending patterns over daily, weekly and monthly periods."},
  {icon:Utensils,title:"Plan everyday budgets",text:"Set budgets, including a weekly food plan that helps divide your allowance across the week."},
  {icon:Heart,title:"Keep priorities visible",text:"Save items to your priority needs list and keep important purchases in perspective."},
];

function Footer() {
  return <footer className="border-t bg-hero py-12 text-on-hero" style={{borderColor:"var(--color-border)"}}>
    <div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-10">
      <div><Brand light/><p className="mt-4 max-w-xs text-sm leading-6 text-on-hero/65">A practical space to keep track of money, plan spending and make room for what matters.</p><p className="mt-5 text-xs text-on-hero/45">Made in Ghana.</p></div>
      <div><div className="mt-4 grid gap-3 text-sm"><Link href="#features">Features</Link><Link href="/about">About Largent</Link><Link href="/install">Install guide</Link></div></div>
      <div><div className="mt-4 grid gap-3 text-sm"><Link href="/faqs">FAQs</Link><Link href="/sign-in">Log in</Link><Link href="/sign-up">Create account</Link></div></div>
      <div><p className="mt-4 text-sm leading-6 text-on-hero/65">Use Largent in your browser, or add it to your phone's Home Screen.</p><Link className="mt-4 inline-flex items-center gap-2 bg-panel px-4 py-3 text-sm font-semibold text-foreground" href="/install">How to install <ArrowRight size={16}/></Link></div>
    </div>
    <div className="mx-auto mt-10 max-w-7xl border-t border-on-hero/15 px-5 pt-5 text-xs text-on-hero/45 lg:px-10">© {new Date().getFullYear()} Largent. All rights reserved.</div>
  </footer>;
}

export default function LandingPage() {
  return <div className="min-h-screen bg-page text-foreground">
    <Header/>
    <main>
      <section className="relative isolate overflow-hidden bg-[#f4f4f0] text-[#171717]"><div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[54%] bg-[url('/largent-grid.svg')] bg-cover bg-center opacity-[.08] lg:block" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-4 px-5 pb-12 pt-14 lg:grid-cols-[.88fr_1.12fr] lg:px-10 lg:pb-20 lg:pt-20">
          <div className="relative z-10">
            
            <p className="mb-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-black/55"><span className="h-2 w-2 bg-[#315BEA]"/> A more intentional way to manage money</p><h1 className="mt-2 max-w-xl text-5xl font-semibold leading-[1.04] tracking-[-.055em] text-black sm:text-6xl lg:text-[4.6rem]">Make your money feel <span className="text-brand">more manageable.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-black/65">Largent helps you record your money, understand everyday spending, plan budgets and keep the things you’re saving for in view.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link className="inline-flex min-h-12 items-center gap-3 bg-[#171717] px-6 text-sm font-semibold text-white hover:bg-[#315BEA]" href="/sign-up">Get started <ArrowRight size={17}/></Link><Link className="inline-flex min-h-12 items-center border border-black/20 px-6 text-sm font-semibold text-black hover:bg-white" href="/sign-in">I already have an account</Link></div>
            <p className="mt-5 text-xs text-black/50">A web app. No App Store or Google Play download required.</p>
          </div>
          <HeroArtwork/>
        </div>
      </section>
      <section className="border-y bg-panel py-6" style={{borderColor:line}}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 text-xs font-semibold text-muted sm:text-sm lg:justify-between lg:px-10">
          <span className="flex items-center gap-2"><Wallet size={17} className="text-brand"/> Accounts and balances</span>
          <span className="flex items-center gap-2"><BarChart3 size={17} className="text-brand"/> Spending history</span>
          <span className="flex items-center gap-2"><Utensils size={17} className="text-brand"/> Weekly food budgets</span>
          <span className="flex items-center gap-2"><ListChecks size={17} className="text-brand"/> Priority needs</span>
        </div>
      </section>
      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-10">
          <div className="max-w-2xl"><h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-.04em] sm:text-5xl">A clearer view of the money decisions you make every day.</h2><p className="mt-5 text-base leading-7 text-muted">Largent brings a few useful money-management tools into one straightforward workspace.</p></div>
          <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">{features.map(({icon:Icon,title,text},i)=><article key={title} className="border-t-2 border-brand pt-6"><div className="flex h-12 w-12 items-center justify-center bg-panel text-brand"><Icon size={22}/></div><p className="mt-6 text-xs font-bold text-brand">0{i+1}</p><h3 className="mt-2 text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted">{text}</p></article>)}</div>
        </div>
      </section>
      <section className="bg-brand-soft py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2 lg:px-10">
          <div><h2 className="mt-4 text-4xl font-semibold tracking-[-.04em]">Start with what you know. Build from there.</h2><p className="mt-5 max-w-lg text-sm leading-7 text-muted">You don’t need to connect a bank account or import a statement to begin. Start by recording the accounts and transactions you want to keep track of.</p></div>
          <ol className="grid gap-4">{[{n:"01",t:"Create your account",d:"Sign up to keep your Largent data associated with your account."},{n:"02",t:"Set up your accounts",d:"Add the accounts and starting balances you want to track."},{n:"03",t:"Record and review",d:"Add transactions, set budgets and check your spending over time."}].map(s=><li key={s.n} className="flex gap-5 border-b border-outline py-5"><span className="text-sm font-bold text-brand">{s.n}</span><div><h3 className="font-semibold">{s.t}</h3><p className="mt-1 text-sm leading-6 text-muted">{s.d}</p></div></li>)}</ol>
        </div>
      </section>
      <section className="py-20 lg:py-24"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 md:flex-row md:items-center md:justify-between lg:px-10"><div className="max-w-2xl"><h2 className="mt-4 text-4xl font-semibold tracking-[-.04em]">Add Largent to your phone’s Home Screen.</h2><p className="mt-4 text-sm leading-7 text-muted">Largent is a progressive web app. You can open it in a browser or install it from the browser menu for a more app-like shortcut.</p></div><Link href="/install" className="inline-flex min-h-12 shrink-0 items-center gap-3 border border-foreground px-6 text-sm font-semibold hover:bg-panel">See installation steps <ArrowUpRight size={17}/></Link></div></section>
      <section className="bg-hero py-20 text-on-hero"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 md:flex-row md:items-center md:justify-between lg:px-10"><div><h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-[-.04em]">Make a little more sense of your money.</h2><p className="mt-4 text-sm text-on-hero/65">Create an account and start with the information you already have.</p></div><Link href="/sign-up" className="inline-flex min-h-12 items-center gap-3 bg-panel px-6 text-sm font-semibold text-foreground">Create your account <ArrowRight size={17}/></Link></div></section>
    </main>
    <Footer/>
  </div>;
}
