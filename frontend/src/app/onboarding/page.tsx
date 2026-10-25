import { OnboardingPage } from "@/features/onboarding/OnboardingPage";
import { safeReturnPath } from "@/lib/routing";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string; redirect_url?: string }>;
}) {
  const { replay, redirect_url } = await searchParams;
  return <OnboardingPage isReplay={replay === "1"} returnTo={safeReturnPath(redirect_url)} />;
}
