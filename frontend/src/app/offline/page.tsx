import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        Largent
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        You&apos;re offline
      </h1>
      <p className="mt-3 leading-6 text-muted">
        You&apos;re offline. Changes need a connection.
      </p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 font-semibold text-on-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        href="/"
      >
        Try again
      </Link>
    </main>
  );
}
