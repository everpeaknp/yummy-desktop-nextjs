import * as React from "react";

import { cn } from "@/lib/utils";

type SurfaceKind =
  "summary" | "section" | "interactive" | "information" | "warning" | "table";

const surfaceClasses: Record<SurfaceKind, string> = {
  summary: "rounded-2xl border border-border bg-card p-4 md:p-5",
  section: "rounded-2xl border border-border bg-card p-4 md:p-5",
  interactive:
    "rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/25 hover:bg-muted/20",
  information:
    "rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-foreground",
  warning:
    "rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-foreground",
  table: "overflow-hidden rounded-2xl border border-border bg-card",
};

export function Surface({
  kind = "section",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { kind?: SurfaceKind }) {
  return (
    <div
      className={cn("min-w-0", surfaceClasses[kind], className)}
      {...props}
    />
  );
}
