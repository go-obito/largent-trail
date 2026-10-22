import { BudgetsPage } from "@/features/budgets/components/BudgetsPage";

export default async function BudgetsRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <BudgetsPage initialTab={tab === "categories" ? "categories" : "overview"} />
  );
}
