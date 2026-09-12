import * as React from "react";

import { cn } from "@/lib/utils";

export interface SummaryCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export function SummaryCard({ title, description, action, className, children, ...props }: SummaryCardProps) {
  return (
    <div className={cn("min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5", className)} {...props}>
      {title || description || action ? (
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
