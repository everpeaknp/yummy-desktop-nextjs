"use client";

import { useState } from "react";
import { Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { LivePromoCode, LivePromoStatus } from "@/lib/live-promo-types";
import { computePromoStatus } from "@/lib/live-promo-service";

interface LivePromoListViewProps {
  promos: LivePromoCode[];
}

export function LivePromoListView({ promos }: LivePromoListViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statusConfig: Record<LivePromoStatus, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
    scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
    expired: { label: "Expired", className: "bg-muted text-muted-foreground" },
    disabled: { label: "Disabled", className: "bg-muted text-muted-foreground" },
  };

  if (promos.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Code</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Benefit</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Usage</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Valid Until</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {promos.map((promo) => {
              const status = computePromoStatus(promo);
              const config = statusConfig[status];
              const usagePercent = promo.usageLimit > 0 ? (promo.currentUsage / promo.usageLimit) * 100 : 0;
              const isInactive = status === "expired" || status === "disabled";
              const isCopied = copiedId === promo.id;

              return (
                <tr
                  key={promo.id}
                  className={cn(
                    "transition-colors hover:bg-muted/30",
                    isInactive && "opacity-60"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">{promo.code}</span>
                      <Button
                        onClick={() => handleCopy(promo.code, promo.id)}
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 rounded-md"
                        title="Copy code"
                      >
                        {isCopied ? (
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {promo.type === "referral" ? "Referral" : "Offer"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-sm">{promo.benefit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("text-xs", config.className)}>
                      {config.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Progress value={usagePercent} className="h-1.5 flex-1" />
                      <span className="text-xs font-medium tabular-nums whitespace-nowrap">
                        {promo.currentUsage}/{promo.usageLimit}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {new Date(promo.endDate).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
