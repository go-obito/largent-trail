"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className="mb-6 rounded-2xl border border-outline bg-panel-raised px-4 py-3 text-sm font-medium text-foreground"
      role="status"
    >
      You&apos;re offline. Changes need a connection.
    </p>
  );
}
