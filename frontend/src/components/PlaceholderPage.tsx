import { EmptyState } from "./states/EmptyState";

type PlaceholderPageProps = {
  caption: string;
  title: string;
  description: string;
};

export function PlaceholderPage({
  caption,
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {caption}
      </p>
      <h2 className="mb-5 text-3xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <EmptyState
        description={description}
        title="This space is ready for you"
      />
    </section>
  );
}
