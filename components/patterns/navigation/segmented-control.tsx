import * as React from "react";

import { cn } from "@/lib/utils";

export function SegmentedControl({
  value,
  onValueChange,
  items,
  ariaLabel,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ value: string; label: React.ReactNode; disabled?: boolean }>;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-grid min-h-11 max-w-full rounded-xl bg-muted p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          disabled={item.disabled}
          aria-pressed={value === item.value}
          onClick={() => onValueChange(item.value)}
          className={cn(
            "min-h-11 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-sm",
            value === item.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
