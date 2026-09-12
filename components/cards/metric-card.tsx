import * as React from "react";

import { cn } from "@/lib/utils";

type MetricTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const tones: Record<MetricTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  detail?: React.ReactNode;
  trend?: React.ReactNode;
  tone?: MetricTone;
}

export function MetricCard({ label, value, icon, detail, trend, tone = "neutral", className, ...props }: MetricCardProps) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-border bg-card p-3.5 shadow-sm sm:p-4", className)} {...props}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 truncate text-xl font-semibold leading-tight tracking-[-0.025em] text-foreground tabular-nums sm:text-2xl">{value}</div>
        </div>
        {icon ? <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tones[tone])}>{icon}</div> : null}
      </div>
      {detail || trend ? (
        <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="min-w-0 truncate">{detail}</div>
          {trend ? <div className="shrink-0 font-medium">{trend}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

