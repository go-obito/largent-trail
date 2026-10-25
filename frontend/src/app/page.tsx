import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { OnboardingGate } from "@/features/onboarding/OnboardingGate";
import { LandingPage } from "@/features/welcome/LandingPage";
import { LAST_PRIVATE_ROUTE_COOKIE, safeReturnPath } from "@/lib/routing";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Know what you can spend today | Largent",
  description: "Track spending by day, plan your weekly food budget, organize essentials, and follow savings goals with Largent.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const [{ userId }, cookieStore] = await Promise.all([auth(), cookies()]);
  if (!userId) return <LandingPage />;

  const rememberedPath = safeReturnPath(cookieStore.get(LAST_PRIVATE_ROUTE_COOKIE)?.value);
  if (rememberedPath) redirect(rememberedPath);

  return <OnboardingGate><AppShell><DashboardPage /></AppShell></OnboardingGate>;
}
