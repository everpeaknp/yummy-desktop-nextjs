import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone =
  "success" | "warning" | "negative" | "information" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  negative: "border-destructive/30 bg-destructive/10 text-destructive",
  information:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
  icon?: React.ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "min-h-6 gap-1.5 rounded-full px-2 text-[11px] font-semibold",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </Badge>
  );
}

/** Explicit presentation mapping. Accounting directions are intentionally not mapped here. */
export function statusToneFor(status: string | null | undefined): StatusTone {
  switch (
    String(status ?? "")
      .trim()
      .toLowerCase()
  ) {
    case "paid":
    case "settled":
    case "active":
    case "ready":
      return "success";
    case "pending":
    case "partially returned":
    case "low stock":
    case "overdue":
      return "warning";
    case "returned":
    case "refunded":
    case "voided":
      return "negative";
    case "posted":
      return "information";
    default:
      return "neutral";
  }
}
