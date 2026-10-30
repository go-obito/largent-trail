import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/AppShell";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { OnboardingGate } from "@/features/onboarding/OnboardingGate";
import { LandingPage } from "@/features/welcome/LandingPage";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Largent — Make your money more manageable",
  description: "Record transactions, track accounts, plan everyday budgets and understand your spending with Largent.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) return <LandingPage />;

  return <OnboardingGate><AppShell><DashboardPage /></AppShell></OnboardingGate>;
}
