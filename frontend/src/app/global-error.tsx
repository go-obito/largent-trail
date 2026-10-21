"use client";

import { CrashFallback } from "@/components/states/CrashFallback";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#111521",
          color: "#f4f5f8",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
        }}
      >
        <CrashFallback error={error} reset={reset} />
      </body>
    </html>
  );
}
