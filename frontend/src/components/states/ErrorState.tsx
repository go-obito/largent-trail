import Button from "@mui/material/Button";

type ErrorStateProps = {
  onRetry: () => void;
  title?: string;
  description?: string;
};

export function ErrorState({
  onRetry,
  title = "We couldn't load this",
  description = "Check your connection and try again.",
}: ErrorStateProps) {
  return (
    <section
      aria-live="polite"
      className="card-surface p-6 text-center"
    >
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      <Button className="mt-4" onClick={onRetry} variant="contained">
        Try again
      </Button>
    </section>
  );
}
