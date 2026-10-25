import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/AppShell";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { OnboardingGate } from "@/features/onboarding/OnboardingGate";
import { LandingPage } from "@/features/welcome/LandingPage";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Know what you can spend today | Largent",
  description: "Track spending by day, plan your weekly food budget, organize essentials, and follow savings goals with Largent.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) return <LandingPage />;

  return <OnboardingGate><AppShell><DashboardPage /></AppShell></OnboardingGate>;
}
