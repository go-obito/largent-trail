import { TransactionForm } from "@/features/transactions/components/TransactionForm";

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;

  return (
    <TransactionForm
      initialKind={kind === "income" ? "income" : "expense"}
      mode="create"
    />
  );
}
