"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DayCloseMetricCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  iconClassName?: string;
  iconPosition?: "inline" | "top-right";
  accent?: string;
  valueClassName?: string;
  compact?: boolean;
  dense?: boolean;
  className?: string;
};

export function DayCloseMetricCard({
  label,
  value,
  icon,
  iconClassName,
  iconPosition = "inline",
  accent = "from-primary/40 to-primary",
  valueClassName,
  compact = false,
  dense = false,
  className,
}: DayCloseMetricCardProps) {
  const iconTopRight = Boolean(icon) && iconPosition === "top-right";

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
          compact
            ? dense
              ? "p-3 min-h-[76px]"
              : "p-4 min-h-[96px]"
            : "p-5 min-h-[120px]",
          iconTopRight && (dense ? "pr-9" : "pr-12"),
        )}
      >
        {iconTopRight ? (
          <div
            className={cn(
              "absolute rounded-md border transition-colors shrink-0",
              dense ? "top-2 right-2 p-1" : "top-3 right-3 p-1.5",
              iconClassName ??
                "border-black/10 bg-white text-neutral-700 group-hover:border-black/20 dark:border-white/25 dark:bg-muted dark:text-foreground dark:group-hover:border-white/40",
            )}
          >
            {icon}
          </div>
        ) : null}
        <div
          className={cn(
            "flex items-start gap-2 mb-1.5 min-h-[1.75rem]",
            dense && "min-h-[1.5rem] mb-1",
            iconTopRight && (dense ? "pr-1" : "pr-2"),
          )}
        >
          {icon && !iconTopRight ? (
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
          <p className={cn("dc-metric-label leading-snug", dense && "text-[11px] leading-tight")}>
            {label}
          </p>
        </div>
        <p
          className={cn(
            "dc-metric-value tabular-nums leading-tight",
            dense ? "text-sm" : compact ? "text-lg" : "text-xl",
            valueClassName,
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
