"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type CrashFallbackProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function CrashFallback({ error, reset }: CrashFallbackProps) {
  const router = useRouter();

  useEffect(() => {
    console.error("The application failed to render.", error);
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-dvh items-center justify-center bg-page px-5 py-10 text-foreground"
    >
      <section className="card-surface w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">We couldn&apos;t load this page</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Something went wrong. Try again, or return to sign in.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            className="rounded-xl bg-brand px-4 py-2 font-medium text-on-brand"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <button
            className="rounded-xl border border-outline px-4 py-2 font-medium text-foreground"
            onClick={() => router.push("/sign-in")}
            type="button"
          >
            Go to sign in
          </button>
        </div>
      </section>
    </main>
  );
}
