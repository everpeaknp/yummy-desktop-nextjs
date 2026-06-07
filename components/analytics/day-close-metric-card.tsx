"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Cash in — green */
export const DC_METRIC_ACCENT_IN = "from-green-600/35 to-green-600/5";
export const DC_METRIC_ICON_IN =
  "border-green-200 bg-green-50 text-green-600 group-hover:border-green-300 group-hover:bg-green-100 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400 dark:group-hover:border-green-400/50 dark:group-hover:bg-green-500/15";
export const DC_METRIC_VALUE_IN = "text-green-600 dark:text-green-400";

/** Cash out — red (theme destructive) */
export const DC_METRIC_ACCENT_OUT = "from-destructive/35 to-destructive/5";
export const DC_METRIC_ICON_OUT =
  "border-destructive/20 bg-destructive/5 text-destructive group-hover:border-destructive/30 group-hover:bg-destructive/10";
export const DC_METRIC_VALUE_OUT = "text-destructive";

/** @deprecated use DC_METRIC_ACCENT_IN */
export const DC_METRIC_ACCENT = DC_METRIC_ACCENT_IN;
/** @deprecated use DC_METRIC_ACCENT_OUT */
export const DC_METRIC_ACCENT_DESTRUCTIVE = DC_METRIC_ACCENT_OUT;
/** @deprecated use DC_METRIC_ICON_IN */
export const DC_METRIC_ICON = DC_METRIC_ICON_IN;
/** @deprecated use DC_METRIC_ICON_OUT */
export const DC_METRIC_ICON_DESTRUCTIVE = DC_METRIC_ICON_OUT;

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
  onClick?: () => void;
};

export function DayCloseMetricCard({
  label,
  value,
  icon,
  iconClassName,
  iconPosition = "inline",
  accent = DC_METRIC_ACCENT_IN,
  valueClassName,
  compact = false,
  dense = false,
  className,
  onClick,
}: DayCloseMetricCardProps) {
  const iconTopRight = Boolean(icon) && iconPosition === "top-right";
  const cornerSize = dense
    ? "h-12 w-12 rounded-bl-[48px]"
    : "h-16 w-16 rounded-bl-[56px]";

  const cornerSpread =
    "group-hover:h-full group-hover:w-full group-active:h-full group-active:w-full group-hover:rounded-2xl group-active:rounded-2xl group-hover:opacity-[0.12] group-active:opacity-[0.12]";

  return (
    <Card
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "dc-card hover:-translate-y-1 active:-translate-y-1 transition-all duration-300 group overflow-hidden relative h-full",
        onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute z-0 top-0 right-0 origin-top-right bg-gradient-to-bl transition-all duration-500 ease-out",
          accent,
          cornerSize,
          "opacity-100",
          cornerSpread,
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
              iconClassName ?? DC_METRIC_ICON_IN,
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
                iconClassName ?? DC_METRIC_ICON_IN,
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
