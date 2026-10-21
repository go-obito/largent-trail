"use client";

import { CrashFallback } from "@/components/states/CrashFallback";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <CrashFallback error={error} reset={reset} />;
}
