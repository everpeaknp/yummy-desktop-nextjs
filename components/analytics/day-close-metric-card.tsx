"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DayCloseMetricCardProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: string;
  compact?: boolean;
  className?: string;
};

export function DayCloseMetricCard({
  label,
  value,
  icon,
  accent = "from-primary/40 to-primary",
  compact = false,
  className,
}: DayCloseMetricCardProps) {
  return (
    <Card
      className={cn(
        "bg-card/80 backdrop-blur-sm border-border/50 shadow-sm rounded-2xl hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative h-full",
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
        <div className="flex items-center gap-2 mb-2">
          {icon ? (
            <div className="p-1.5 rounded-md bg-muted text-muted-foreground group-hover:text-primary transition-colors shrink-0">
              {icon}
            </div>
          ) : null}
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
            {label}
          </p>
        </div>
        <p
          className={cn(
            "font-black text-foreground tabular-nums tracking-tight",
            compact ? "text-lg" : "text-xl",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
