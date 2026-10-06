"use client";

import { useState } from "react";
import { Copy, CheckCircle2, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { LivePromoCode, LivePromoStatus } from "@/lib/live-promo-types";
import { computePromoStatus } from "@/lib/live-promo-service";

interface LivePromoCardProps {
  promo: LivePromoCode;
}

export function LivePromoCard({ promo }: LivePromoCardProps) {
  const [copied, setCopied] = useState(false);

  const status = computePromoStatus(promo);
  const usagePercent = promo.usageLimit > 0 ? (promo.currentUsage / promo.usageLimit) * 100 : 0;

  // Calculate days until expiry
  const now = new Date();
  const endDate = new Date(promo.endDate);
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 3 && status === "active";

  const handleCopy = () => {
    navigator.clipboard.writeText(promo.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig: Record<LivePromoStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className: string }> = {
    active: { label: "Active", variant: "default", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
    scheduled: { label: "Scheduled", variant: "secondary", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" },
    expired: { label: "Expired", variant: "outline", className: "bg-muted text-muted-foreground" },
    disabled: { label: "Disabled", variant: "outline", className: "bg-muted text-muted-foreground" },
  };

  const config = statusConfig[status];
  const isInactive = status === "expired" || status === "disabled";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border-2 border-dashed bg-card transition-all hover:shadow-md",
        status === "active" ? "border-primary/40 hover:border-primary/60" : "border-muted",
        isInactive && "opacity-60"
      )}
    >
      <div className="p-5 space-y-4">
        {/* Header: Code and Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <p className="font-mono text-xl font-bold tracking-wide text-primary truncate">
                {promo.code}
              </p>
              <Button
                onClick={handleCopy}
                size="sm"
                variant="ghost"
                className={cn(
                  "h-7 w-7 p-0 rounded-md transition-all opacity-0 group-hover:opacity-100",
                  copied && "opacity-100"
                )}
                title="Copy code"
              >
                {copied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={config.variant} className={cn("text-xs", config.className)}>
                {config.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {promo.type === "referral" ? "Referral" : "Offer"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Benefit Display */}
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-foreground">{promo.benefit}</p>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{promo.description}</p>
        </div>

        {/* Usage Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Usage
            </span>
            <span className="font-medium tabular-nums">
              {promo.currentUsage} / {promo.usageLimit}
            </span>
          </div>
          <Progress value={usagePercent} className="h-1.5" />
        </div>

        {/* Dates */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>
              {new Date(promo.startDate).toLocaleDateString()} - {new Date(promo.endDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Expiry Warning */}
        {isExpiringSoon && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
              Expires in {daysUntilExpiry} {daysUntilExpiry === 1 ? "day" : "days"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
