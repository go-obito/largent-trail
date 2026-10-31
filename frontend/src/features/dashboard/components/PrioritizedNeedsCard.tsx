import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "next/link";
import { Check } from "lucide-react";
import type { components } from "@/lib/api/schema";
import { ProductBrandLogo } from "@/components/brand/ProductBrandLogo";
import { formatGhs } from "@/lib/money";
import { DashboardSection } from "./DashboardSection";

type DashboardRead = components["schemas"]["DashboardRead"];

type PrioritizedNeedsCardProps = {
  data?: DashboardRead;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
};

const priorityLabels = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
} as const;

export function PrioritizedNeedsCard({
  data,
  isError,
  isLoading,
  onRetry,
}: PrioritizedNeedsCardProps) {
  const items = data?.needs.items.slice(0, 5);

  return (
    <DashboardSection
      isError={isError}
      isLoading={isLoading}
      label="prioritized needs"
      onRetry={onRetry}
    >
      {data && (
        <section className="rounded-xl border border-outline bg-surface h-full p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Save with intention</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">Prioritized needs</h2>
            </div>
            <Button
              component={Link}
              href="/needs"
              sx={{ minHeight: 44 }}
              variant="text"
            >
              Add item
            </Button>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">
            {formatGhs(data.needs.total_allocated_minor)} allocated of{" "}
            {formatGhs(data.needs.total_target_minor)} planned
          </p>
          {data.needs.over_allocated && (
            <p className="mt-2 text-sm font-semibold text-status-warning">
              Your planned needs exceed the available savings.
            </p>
          )}

          {items?.length ? (
            <div className="mt-5 space-y-4 sm:space-y-5">
              {items.map((item) => (
                <article key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductBrandLogo name={item.name} size={40} />
                      <div className="min-w-0">
                        <h3 className="break-words font-semibold text-foreground">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                          {priorityLabels[item.priority]}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {item.is_complete && (
                        <span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-status-success">
                          <Check aria-hidden="true" size={14} />
                          Complete
                        </span>
                      )}
                      <p className="text-sm font-medium text-foreground">
                        {formatGhs(item.allocated_minor)} of{" "}
                        {formatGhs(item.target_minor)}
                      </p>
                    </div>
                  </div>
                  <LinearProgress
                    aria-label={`${item.name}: ${item.is_complete ? 100 : item.percent}% complete`}
                    color={item.is_complete ? "success" : "primary"}
                    sx={{ mt: 2, height: 7, borderRadius: 99 }}
                    value={item.is_complete ? 100 : Math.min(100, Math.max(0, item.percent))}
                    variant="determinate"
                  />
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-panel-raised p-4 text-center font-medium text-muted">
              Nothing on your list yet
            </p>
          )}
        </section>
      )}
    </DashboardSection>
  );
}
