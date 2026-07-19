"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatTimezoneLabel, getAllTimezones } from "@/lib/timezones";

type TimezoneSelectProps = {
  value: string;
  onChange: (timezone: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
};

export function TimezoneSelect({
  value,
  onChange,
  id,
  placeholder = "Select timezone",
  className,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const timezones = useMemo(() => getAllTimezones(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return timezones;
    return timezones.filter(
      (tz) =>
        tz.toLowerCase().includes(q) ||
        tz.replace(/_/g, " ").toLowerCase().includes(q) ||
        formatTimezoneLabel(tz).toLowerCase().includes(q)
    );
  }, [query, timezones]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-10 w-full justify-between px-3 font-normal focus-visible:ring-0 focus-visible:ring-offset-0",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{value ? formatTimezoneLabel(value) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] overflow-hidden border-border p-0 shadow-lg"
        align="start"
      >
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-primary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search timezones…"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No timezone found.</p>
          ) : (
            filtered.map((tz) => {
              const selected = tz === value;
              return (
                <button
                  key={tz}
                  type="button"
                  onClick={() => {
                    onChange(tz);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    "hover:bg-primary/10 hover:text-primary",
                    selected && "bg-primary/15 font-medium text-primary"
                  )}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0 text-primary",
                      selected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{formatTimezoneLabel(tz)}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
