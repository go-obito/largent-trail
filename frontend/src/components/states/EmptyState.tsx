type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="rounded-3xl border border-outline bg-panel p-6 text-center">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </section>
  );
}
