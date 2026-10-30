import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BarChart3, Check, ChevronRight, CircleHelp,
  Download, Heart, ListChecks, Menu, Smartphone, Wallet, Utensils,
} from "lucide-react";

const ink = "var(--color-text-primary)";
const blue = "var(--color-primary)";
const muted = "var(--color-text-secondary)";
const line = "var(--color-border)";

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className="text-[1.65rem] font-black tracking-[-0.07em]" style={{ color: "var(--color-text-primary)" }}>largent<span style={{ color: blue }}>.</span></Link>;
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
    <div className="relative mx-auto min-h-[430px] w-full max-w-[620px] sm:min-h-[510px]" aria-label="Illustration of Largent's money planning features" role="img">
      <div className="absolute right-[5%] top-[5%] h-[76%] w-[75%] bg-brand-soft" />
      <div className="absolute right-[12%] top-[13%] h-[68%] w-[76%] border border-outline bg-panel p-5 shadow-[0_24px_60px_-38px_rgba(25,25,25,.45)] sm:p-7">
        <div className="flex items-center justify-between border-b border-outline pb-4">
          <div><div className="text-xs font-semibold text-foreground">Your money overview</div><div className="mt-1 text-[10px] text-muted">A clearer picture of your spending</div></div>
          <span className="bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand">OVERVIEW</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="bg-brand p-4 text-on-hero"><div className="text-[10px] text-on-hero/75">Account balance</div><div className="mt-2 text-2xl font-bold tracking-tight">Your balance</div><div className="mt-4 text-[10px] text-on-hero/75">Across your accounts</div></div>
          <div className="border border-outline p-4"><div className="text-[10px] text-muted">Daily spending</div><div className="mt-2 text-lg font-bold text-foreground">Stay aware</div><div className="mt-4 h-2 bg-surface-container-high"><div className="h-full w-2/3 bg-brand"/></div><div className="mt-2 text-[10px] text-muted">Track your day</div></div>
        </div>
        <div className="mt-4 border border-outline p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Spending by day</span><span className="text-[10px] text-muted">Weekly view</span></div>
          <div className="mt-5 flex h-24 items-end gap-2">{[42,66,51,82,58,74,38].map((h,i)=><span key={i} className="flex-1" style={{height:`${h}%`,background:i===3?blue:"#C8D6F5"}}/>)}</div>
          <div className="mt-2 flex justify-between text-[9px] text-muted"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
        </div>
        <div className="mt-4 flex items-center gap-3 border-t border-outline pt-4">
          <span className="flex h-9 w-9 items-center justify-center bg-status-success/10 text-status-success"><ListChecks size={18}/></span>
          <div><div className="text-xs font-semibold text-foreground">Priority needs</div><div className="text-[10px] text-muted">Keep important purchases in view</div></div>
        </div>
      </div>
      <div className="absolute bottom-[4%] left-[1%] w-[39%] border-[7px] border-foreground bg-panel p-3 shadow-[0_20px_50px_-25px_rgba(25,25,25,.5)] sm:left-0 sm:w-[36%]">
        <div className="mx-auto mb-3 h-1 w-10 bg-hero"/>
        <div className="bg-brand p-3 text-on-hero"><div className="text-[9px] text-on-hero/75">Your accounts</div><div className="mt-2 text-sm font-bold">One clear view</div><div className="mt-4 h-1 w-full bg-panel/30"><div className="h-1 w-2/3 bg-panel"/></div></div>
        <div className="mt-3 space-y-2"><div className="h-2 w-4/5 bg-surface-container-high"/><div className="h-2 w-3/5 bg-surface-container-high"/><div className="h-2 w-2/3 bg-surface-container-high"/></div>
      </div>
      <div className="absolute bottom-[12%] right-[2%] flex items-center gap-2 bg-status-success/10 px-4 py-3 text-xs font-semibold text-status-success"><Check size={16}/> Built around everyday money</div>
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
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-4 px-5 pb-12 pt-14 lg:grid-cols-[.88fr_1.12fr] lg:px-10 lg:pb-20 lg:pt-20">
          <div className="relative z-10">
            
            <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-[1.04] tracking-[-.055em] sm:text-6xl lg:text-[4.6rem]">Make your money feel <span className="text-brand">more manageable.</span></h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted">Largent helps you record your money, understand everyday spending, plan budgets and keep the things you’re saving for in view.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link className="inline-flex min-h-12 items-center gap-3 bg-brand px-6 text-sm font-semibold text-on-hero hover:bg-brand-hover" href="/sign-up">Get started <ArrowRight size={17}/></Link><Link className="inline-flex min-h-12 items-center border border-outline px-6 text-sm font-semibold hover:bg-panel" href="/sign-in">I already have an account</Link></div>
            <p className="mt-5 text-xs text-muted">A web app. No App Store or Google Play download required.</p>
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
