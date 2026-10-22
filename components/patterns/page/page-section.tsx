import * as React from "react";

import { cn } from "@/lib/utils";

export interface PageSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  surface?: boolean;
}

export function PageSection({ title, description, action, surface = false, className, children, ...props }: PageSectionProps) {
  return (
    <section
      className={cn(
        "min-w-0",
        surface && "rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5",
        className
      )}
      {...props}
    >
      {title || description || action ? (
        <div className="mb-3 flex min-w-0 items-start justify-between gap-3 md:mb-4">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold tracking-tight text-foreground md:text-lg">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PageActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} {...props} />;
}
