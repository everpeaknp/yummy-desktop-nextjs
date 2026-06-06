"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type DayCloseBreakdownSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

export function DayCloseBreakdownSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: DayCloseBreakdownSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="text-left space-y-2 pb-4 border-b border-border/40">
          <SheetTitle className="text-xl font-bold tracking-tight">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="py-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
