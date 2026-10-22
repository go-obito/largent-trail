import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { welcomeCopy } from "@/features/welcome/copy";

export default function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main className="min-h-dvh bg-page text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6">
        <header className="flex min-h-16 items-center">
          <Logo />
        </header>
        <div className="grid flex-1 items-center gap-7 pb-6 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(400px,440px)] lg:gap-20">
          <section
            aria-labelledby="auth-introduction-title"
            className="mx-auto w-full max-w-xl lg:mx-0"
          >
            <h1
              className="max-w-[14ch] text-3xl font-bold leading-tight tracking-[-0.035em] sm:text-4xl lg:text-5xl"
              id="auth-introduction-title"
            >
              {welcomeCopy.headline}
            </h1>
            <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-muted sm:text-lg">
              {welcomeCopy.description}
            </p>
            <ul className="mt-8 hidden space-y-4 md:block">
              {welcomeCopy.valuePoints.map(({ icon: Icon, label }) => (
                <li className="flex items-center gap-3" key={label}>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-selected text-brand">
                    <Icon aria-hidden="true" size={21} strokeWidth={2} />
                  </span>
                  <span className="font-medium">{label}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="mx-auto w-full max-w-[440px]">{children}</section>
        </div>
      </div>
    </main>
  );
}
