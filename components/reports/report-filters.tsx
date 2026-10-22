import * as React from "react";

import {
  FilterBar,
  type FilterBarProps,
} from "@/components/patterns/controls/filter-bar";
import { cn } from "@/lib/utils";

export function ReportFilters({
  variant = "surface",
  className,
  ...props
}: FilterBarProps & { variant?: "flat" | "surface" }) {
  return (
    <div
      className={cn(
        variant === "surface"
          ? "rounded-2xl border border-border bg-card p-2.5 shadow-sm md:p-3"
          : "border-y border-border py-3",
        className,
      )}
    >
      <FilterBar {...props} />
    </div>
  );
}
