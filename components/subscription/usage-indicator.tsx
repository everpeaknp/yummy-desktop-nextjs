"use client";

import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { entitlementLabel } from "@/lib/subscription/entitlements";
import type { SubscriptionUsage } from "@/lib/subscription/types";

function UsageLabel({ entitlementKey, className }: { entitlementKey: string; className?: string }) {
  const label = entitlementKey === "users.max" ? "Team users" : entitlementLabel(entitlementKey);

  if (entitlementKey !== "users.max") {
    return <span className={className}>{label}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {label}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Billing owner is excluded from team user count"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px]">
            Billing owner excluded
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

export function UsageIndicator({
  entitlementKey,
  usage,
  compact = false,
}: {
  entitlementKey: string;
  usage: SubscriptionUsage;
  compact?: boolean;
}) {
  const limit = usage.limit;
  const unlimited = limit == null;
  const percentage =
    unlimited || limit === 0 ? 0 : Math.min(100, Math.max(0, (usage.used / limit) * 100));
  const warning = !unlimited && percentage >= 80;

  if (compact) {
    return (
      <div className="flex h-full min-h-[88px] flex-col justify-between rounded-xl border bg-card p-3.5">
        <UsageLabel
          entitlementKey={entitlementKey}
          className="text-xs font-medium text-muted-foreground"
        />
        <div>
          <p
            className={cn(
              "text-lg font-bold tabular-nums tracking-tight",
              warning && "text-amber-600",
            )}
          >
            {usage.used.toLocaleString()}
            <span className="text-sm font-medium text-muted-foreground">
              {" "}
              / {unlimited ? "∞" : usage.limit?.toLocaleString()}
            </span>
          </p>
          {!unlimited ? (
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
              aria-label={`${percentage.toFixed(0)} percent used`}
            >
              <div
                className={cn("h-full rounded-full bg-primary transition-all", warning && "bg-amber-500")}
                style={{ width: `${percentage}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <UsageLabel entitlementKey={entitlementKey} className="font-semibold capitalize" />
        <span
          className={cn("tabular-nums text-muted-foreground", warning && "font-semibold text-amber-600")}
        >
          {usage.used.toLocaleString()} / {unlimited ? "Unlimited" : usage.limit?.toLocaleString()}
        </span>
      </div>
      {!unlimited && (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          aria-label={`${percentage.toFixed(0)} percent used`}
        >
          <div
            className={cn("h-full rounded-full bg-primary transition-all", warning && "bg-amber-500")}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
