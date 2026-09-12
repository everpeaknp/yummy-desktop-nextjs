"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  activeCount?: number;
  mobileContent?: React.ReactNode;
  mobileFooter?: React.ReactNode;
  actions?: React.ReactNode;
  mobileActionsPosition?: "before" | "after";
  mobileTriggerVariant?: "full" | "icon";
}

export function FilterBar({
  title = "Filters",
  activeCount = 0,
  mobileContent,
  mobileFooter,
  actions,
  mobileActionsPosition = "after",
  mobileTriggerVariant = "full",
  className,
  children,
  ...props
}: FilterBarProps) {
  return (
    <div className={cn("min-w-0", className)} {...props}>
      <div className="hidden min-h-11 min-w-0 flex-wrap items-center gap-2 md:flex">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      <div className="flex items-center gap-2 md:hidden">
        {mobileActionsPosition === "before" ? actions : null}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              aria-label={title}
              className={cn(
                "h-11 rounded-xl border shadow-none",
                mobileTriggerVariant === "icon" ? "relative w-11 shrink-0 justify-center px-0" : "flex-1 justify-between px-3",
              )}
            >
              <span className={cn("flex items-center gap-2", mobileTriggerVariant === "icon" && "sr-only")}>
                <SlidersHorizontal className="h-4 w-4" />
                {title}
              </span>
              {mobileTriggerVariant === "icon" ? <SlidersHorizontal className="h-4 w-4" /> : null}
              {activeCount > 0 ? (
                <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground", mobileTriggerVariant === "icon" && "absolute -right-1 -top-1")}>
                  {activeCount}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[88dvh] overflow-hidden rounded-t-3xl p-0">
            <SheetHeader className="border-b px-5 py-4 text-left">
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="max-h-[calc(88dvh-8rem)] overflow-y-auto overscroll-contain px-5 py-4">
              <div className="space-y-4">{mobileContent ?? children}</div>
            </div>
            {mobileFooter ? <div className="border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{mobileFooter}</div> : null}
          </SheetContent>
        </Sheet>
        {mobileActionsPosition === "after" ? actions : null}
      </div>
    </div>
  );
}
