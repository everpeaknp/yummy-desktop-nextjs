import * as React from "react";

import { FilterBar, type FilterBarProps } from "@/components/patterns/controls/filter-bar";
import { cn } from "@/lib/utils";

export function ReportFilters({ className, ...props }: FilterBarProps) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-2.5 shadow-sm md:p-3", className)}>
      <FilterBar {...props} />
    </div>
  );
}

