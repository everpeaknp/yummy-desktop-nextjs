import { cn } from "@/lib/utils";
import { entitlementLabel } from "@/lib/subscription/entitlements";
import type { SubscriptionUsage } from "@/lib/subscription/types";

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
  const percentage = unlimited || limit === 0
    ? 0
    : Math.min(100, Math.max(0, (usage.used / limit) * 100));
  const warning = !unlimited && percentage >= 80;

  return (
    <div className={cn("space-y-2 rounded-xl border bg-card", compact ? "p-3" : "p-4")}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold capitalize">
          {entitlementKey === "users.max"
            ? "Team users (billing owner excluded)"
            : entitlementLabel(entitlementKey)}
        </span>
        <span className={cn("tabular-nums text-muted-foreground", warning && "font-semibold text-amber-600")}>
          {usage.used.toLocaleString()} / {unlimited ? "Unlimited" : usage.limit?.toLocaleString()}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-label={`${percentage.toFixed(0)} percent used`}>
          <div
            className={cn("h-full rounded-full bg-primary transition-all", warning && "bg-amber-500")}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
