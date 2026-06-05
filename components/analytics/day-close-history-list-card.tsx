"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatDayCloseCurrency,
  formatDayCloseListHeading,
} from "@/lib/day-close-format";
import type { DayCloseListItem } from "@/types/day-close";
import { Calendar, ChevronRight } from "lucide-react";

function statusBadge(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "confirmed") {
    return (
      <span className="inline-flex h-7 items-center rounded-full bg-primary/10 px-3 text-[10px] font-bold uppercase text-primary">
        Confirmed
      </span>
    );
  }
  if (s === "pending") {
    return (
      <span className="inline-flex h-7 items-center rounded-full bg-orange-500/10 px-3 text-[10px] font-bold uppercase text-orange-700 dark:text-orange-500">
        Pending
      </span>
    );
  }
  if (s === "reopened") {
    return (
      <span className="inline-flex h-7 items-center rounded-full bg-amber-500/10 px-3 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-500">
        Reopened
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 items-center rounded-full bg-emerald-500/10 px-3 text-[10px] font-bold uppercase text-emerald-600">
      Open
    </span>
  );
}

type DayCloseHistoryListCardProps = {
  item: DayCloseListItem;
  onOpen: () => void;
  onClose?: () => void;
};

export function DayCloseHistoryListCard({
  item,
  onOpen,
  onClose,
}: DayCloseHistoryListCardProps) {
  const isOpen = String(item.status || "").toLowerCase() === "open";
  const businessLabel =
    String(item.business_line ?? "restaurant").toLowerCase() === "hotel"
      ? "Hotel"
      : "Restaurant";

  return (
    <Card
      className="bg-card border-border shadow-sm hover:border-orange-500/30 hover:shadow-md transition-all cursor-pointer overflow-hidden rounded-2xl"
      onClick={onOpen}
    >
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <div className="flex items-center gap-4 p-5 lg:p-6 flex-1 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug break-words">
                {formatDayCloseListHeading(item)}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {businessLabel} • Close #{item.id}
              </p>
            </div>
          </div>

          <div
            className="border-t lg:border-t-0 lg:border-l border-border/50 bg-muted/20 px-5 py-4 lg:px-6 lg:min-w-[min(100%,420px)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-3 sm:gap-5 flex-1 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Net
                </p>
                <p className="text-sm font-bold tabular-nums truncate mt-0.5">
                  {formatDayCloseCurrency(item.net_sales)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Expected
                </p>
                <p className="text-sm font-bold tabular-nums truncate mt-0.5">
                  {formatDayCloseCurrency(item.expected_cash)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Actual
                </p>
                <p className="text-sm font-bold tabular-nums truncate mt-0.5">
                  {formatDayCloseCurrency(item.actual_cash)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              {statusBadge(item.status)}
              {isOpen && onClose ? (
                <Button
                  className="h-9 px-4 rounded-2xl font-bold bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={onClose}
                >
                  Close
                </Button>
              ) : (
                <button
                  type="button"
                  className={cn(
                    "w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm",
                    "hover:bg-orange-600 transition-colors",
                  )}
                  onClick={onOpen}
                  aria-label="View day close"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
