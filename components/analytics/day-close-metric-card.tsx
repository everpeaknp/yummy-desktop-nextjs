"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DayCloseMetricCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  iconClassName?: string;
  accent?: string;
  valueClassName?: string;
  compact?: boolean;
  className?: string;
};

export function DayCloseMetricCard({
  label,
  value,
  icon,
  iconClassName,
  accent = "from-primary/40 to-primary",
  valueClassName,
  compact = false,
  className,
}: DayCloseMetricCardProps) {
  return (
    <Card
      className={cn(
        "dc-card hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative h-full",
        className,
      )}
    >
      <div
        className={cn(
          "absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b group-hover:w-full group-hover:opacity-5 transition-all duration-500",
          accent,
        )}
      />
      <CardContent
        className={cn(
          "flex flex-col justify-center h-full relative z-10",
          compact ? "p-4 min-h-[96px]" : "p-5 min-h-[120px]",
        )}
      >
        <div className="flex items-start gap-2 mb-2 min-h-[2rem]">
          {icon ? (
            <div
              className={cn(
                "p-1.5 rounded-md border transition-colors shrink-0",
                iconClassName ??
                  "border-black/10 bg-white text-neutral-700 group-hover:border-black/20 dark:border-white/25 dark:bg-muted dark:text-foreground dark:group-hover:border-white/40",
              )}
            >
              {icon}
            </div>
          ) : null}
          <p className="dc-metric-label leading-snug">{label}</p>
        </div>
        <p
          className={cn(
            "dc-metric-value tabular-nums break-all",
            compact ? "text-lg" : "text-xl",
            valueClassName,
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
