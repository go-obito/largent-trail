import type { ReactNode } from "react";

export default function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] items-center justify-center px-5 py-[calc(2rem+env(safe-area-inset-top))] [padding-bottom:calc(2rem+env(safe-area-inset-bottom))]">
      {children}
    </main>
  );
}
