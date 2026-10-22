import { OnboardingPage } from "@/features/onboarding/OnboardingPage";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string }>;
}) {
  const { replay } = await searchParams;
  return <OnboardingPage isReplay={replay === "1"} />;
}
