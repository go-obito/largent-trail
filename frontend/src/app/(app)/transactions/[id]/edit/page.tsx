import { TransactionForm } from "@/features/transactions/components/TransactionForm";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <TransactionForm mode="edit" transactionId={id} />;
}
