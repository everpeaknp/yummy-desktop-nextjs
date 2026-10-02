"use client";

import * as React from "react";
import { Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  loading?: boolean;
  onClear?: () => void;
  containerClassName?: string;
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, containerClassName, loading = false, onClear, value, defaultValue, ...props }, ref) => {
    const hasValue = value != null ? String(value).length > 0 : defaultValue != null && String(defaultValue).length > 0;

    return (
      <div className={cn("relative min-w-0", containerClassName)}>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          type="search"
          value={value}
          defaultValue={defaultValue}
          className={cn(
            "h-11 rounded-xl border border-border bg-card pl-10 pr-10 text-sm shadow-none transition-colors focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/10",
            "[&::-webkit-search-cancel-button]:hidden",
            className
          )}
          {...props}
        />
        {loading ? (
          <Loader2 aria-label="Searching" className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : hasValue && onClear ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={onClear}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  }
);
SearchField.displayName = "SearchField";

