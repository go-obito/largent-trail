import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { OnboardingGate } from "@/features/onboarding/OnboardingGate";

export default function AuthenticatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <OnboardingGate>
      <AppShell>{children}</AppShell>
    </OnboardingGate>
  );
}
