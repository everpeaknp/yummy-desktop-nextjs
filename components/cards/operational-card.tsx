import * as React from "react";

import { cn } from "@/lib/utils";

export interface OperationalCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  status?: React.ReactNode;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  selected?: boolean;
}

export function OperationalCard({ title, status, meta, footer, selected = false, className, children, ...props }: OperationalCardProps) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-2xl border bg-card p-3.5 shadow-sm transition-colors sm:p-4",
        selected ? "border-primary/50 ring-2 ring-primary/10" : "border-border hover:border-primary/20",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</div>
        {status ? <div className="shrink-0 text-xs font-medium">{status}</div> : null}
      </div>
      {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
      {children ? <div className="mt-3 min-w-0 text-sm text-foreground">{children}</div> : null}
      {footer ? <div className="mt-3 border-t border-border pt-2.5 text-xs text-muted-foreground">{footer}</div> : null}
    </article>
  );
}
