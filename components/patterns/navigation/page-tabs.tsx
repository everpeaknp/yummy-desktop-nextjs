"use client";

import * as React from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface PageTabItem {
  value: string;
  label: React.ReactNode;
  mobileLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  disabled?: boolean;
}

export interface PageTabsProps {
  items: PageTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  mobileMode?: "equal" | "scroll" | "select";
  ariaLabel?: string;
  className?: string;
}

function TabLabel({ item }: { item: PageTabItem }) {
  const Icon = item.icon;
  return (
    <>
      {Icon ? <Icon aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
      <span className="truncate">{item.label}</span>
      {item.count != null ? (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary">
          {item.count}
        </span>
      ) : null}
    </>
  );
}

export function PageTabs({
  items,
  value,
  onValueChange,
  mobileMode = "scroll",
  ariaLabel = "Page sections",
  className,
}: PageTabsProps) {
  const equalStyle = mobileMode === "equal" ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined;
  const denseEqualTabs = mobileMode === "equal" && items.length > 4;

  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn("min-w-0", className)}>
      {mobileMode === "select" ? (
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger aria-label={ariaLabel} className="h-11 w-full rounded-xl border md:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
                {item.mobileLabel ?? item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <div
        className={cn(
          "min-w-0",
          mobileMode === "select" && "hidden md:block",
          mobileMode === "scroll" && "overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        <TabsList
          aria-label={ariaLabel}
          style={equalStyle}
          className={cn(
            "h-auto min-h-11 rounded-xl bg-muted/70 p-1",
            mobileMode === "equal" ? "grid w-full" : "inline-flex w-max min-w-full justify-start md:w-auto md:min-w-0"
          )}
        >
          {items.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className={cn(
                "group min-h-9 min-w-0 gap-1.5 rounded-lg px-3 text-xs shadow-none data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:text-sm",
                denseEqualTabs && "gap-0.5 px-1 text-[10px] sm:gap-1.5 sm:px-3 sm:text-sm",
              )}
            >
              <TabLabel item={item} />
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}
