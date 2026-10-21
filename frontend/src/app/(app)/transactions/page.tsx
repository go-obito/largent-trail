import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";
import { TransactionsPage as TransactionsListPage } from "@/features/transactions/components/TransactionsPage";

export default function TransactionsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton label="Loading transactions" rows={5} />}>
      <TransactionsListPage />
    </Suspense>
  );
}
