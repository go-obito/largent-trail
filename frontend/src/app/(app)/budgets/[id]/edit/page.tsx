import { BudgetForm } from "@/features/budgets/components/BudgetForm";

export default async function EditBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BudgetForm budgetId={id} mode="edit" />;
}
