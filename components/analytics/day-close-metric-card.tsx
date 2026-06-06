"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DayCloseMetricCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: string;
  compact?: boolean;
  className?: string;
  hint?: string;
  onClick?: () => void;
};

export function DayCloseMetricCard({
  label,
  value,
  icon,
  accent = "from-primary/40 to-primary",
  compact = false,
  className,
  hint,
  onClick,
}: DayCloseMetricCardProps) {
  const interactive = Boolean(onClick);

  return (
    <Card
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "bg-card/80 backdrop-blur-sm border-border/50 shadow-sm rounded-2xl transition-all duration-300 group overflow-hidden relative h-full",
        interactive
          ? "cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          : "hover:shadow-md",
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
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {icon ? (
              <div className="p-1.5 rounded-md bg-muted text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                {icon}
              </div>
            ) : null}
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-snug">
              {label}
            </p>
          </div>
          {interactive ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-0.5" />
          ) : null}
        </div>
        <p
          className={cn(
            "font-black text-foreground tabular-nums tracking-tight",
            compact ? "text-lg" : "text-xl",
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="text-[10px] text-muted-foreground mt-2 leading-snug line-clamp-2">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
