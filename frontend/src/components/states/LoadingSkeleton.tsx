type LoadingSkeletonProps = {
  label?: string;
  rows?: number;
};

export function LoadingSkeleton({
  label = "Loading",
  rows = 3,
}: LoadingSkeletonProps) {
  return (
    <div
      aria-busy="true"
      className="space-y-4"
      role="status"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="h-16 animate-pulse rounded-3xl bg-panel-raised"
        />
      ))}
    </div>
  );
}
