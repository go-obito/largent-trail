import { ErrorState } from "@/components/states/ErrorState";
import { LoadingSkeleton } from "@/components/states/LoadingSkeleton";

type DashboardSectionProps = {
  children: React.ReactNode;
  isError: boolean;
  isLoading: boolean;
  label: string;
  onRetry: () => void;
};

export function DashboardSection({
  children,
  isError,
  isLoading,
  label,
  onRetry,
}: DashboardSectionProps) {
  if (isLoading) {
    return <LoadingSkeleton label={`Loading ${label}`} rows={1} />;
  }

  if (isError) {
    return (
      <ErrorState
        description={`We couldn't load ${label.toLocaleLowerCase()}.`}
        onRetry={onRetry}
        title={`Unable to load ${label.toLocaleLowerCase()}`}
      />
    );
  }

  return <>{children}</>;
}
