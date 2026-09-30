import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type WorkforceSectionProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Shared operational section framing for Workforce. Sections are deliberately
 * flat; a bounded surface is reserved for the register or an actionable object.
 */
export function WorkforceSection({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: WorkforceSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

export type WorkforceMetricItem = {
  label: string;
  value: string;
  helper?: string;
  icon?: LucideIcon;
  attention?: boolean;
  className?: string;
  valueClassName?: string;
};

/** A compact divider-led summary, not a set of independent dashboard cards. */
export function WorkforceMetricStrip({
  items,
  className,
}: {
  items: WorkforceMetricItem[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid overflow-hidden rounded-xl border bg-card grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={cn(
              "min-w-0 border-b p-3 last:border-b-0 even:border-l lg:border-b-0 lg:border-l lg:first:border-l-0",
              item.className,
            )}
          >
            <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
              <span className="truncate">{item.label}</span>
            </dt>
            <dd
              className={cn(
                "mt-1 text-base font-semibold tabular-nums sm:text-lg",
                item.valueClassName ? "" : "truncate",
                item.attention && "text-amber-700 dark:text-amber-400",
                item.valueClassName,
              )}
            >
              {item.value}
            </dd>
            {item.helper ? (
              <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
                {item.helper}
              </p>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}

export function WorkforceDetailGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {children}
    </dl>
  );
}

export function WorkforceDetail({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 border-b pb-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}
