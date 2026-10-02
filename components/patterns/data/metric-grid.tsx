import * as React from "react";

import {
  MetricCard,
  type MetricCardProps,
} from "@/components/cards/metric-card";
import { cn } from "@/lib/utils";

export type MetricGridDensity = "compact" | "financial";

export function MetricGrid({
  density = "compact",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { density?: MetricGridDensity }) {
  return (
    <div
      className={cn(
        "grid gap-2.5",
        density === "financial"
          ? "grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          : "grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
      {...props}
    />
  );
}

export function CompactMetric({ className, ...props }: MetricCardProps) {
  return (
    <MetricCard
      className={cn("p-3 [&_div.text-xl]:text-lg", className)}
      {...props}
    />
  );
}

export function FinancialSummary({
  label,
  value,
  detail,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-border bg-card p-4",
        className,
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
