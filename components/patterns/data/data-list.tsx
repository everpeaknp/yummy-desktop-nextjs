import * as React from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function DataList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card", className)}
      {...props}
    />
  );
}

export interface ListRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  leading?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  interactive?: boolean;
}

export function ListRow({
  leading,
  title,
  description,
  meta,
  trailing,
  interactive = false,
  className,
  ...props
}: ListRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-14 min-w-0 items-center gap-3 px-3 py-2.5 sm:px-4",
        interactive && "cursor-pointer transition-colors hover:bg-muted/70",
        className
      )}
      {...props}
    >
      {leading ? <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <div className="min-w-0 truncate text-sm font-medium text-foreground">{title}</div>
          {meta ? <div className="ml-auto shrink-0 text-xs text-muted-foreground">{meta}</div> : null}
        </div>
        {description ? <div className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">{description}</div> : null}
      </div>
      {trailing ?? (interactive ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null)}
    </div>
  );
}
