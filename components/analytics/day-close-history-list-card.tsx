"use client";

import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatDayCloseBusinessDate,
  formatDayCloseCloseName,
  formatDayCloseCurrency,
} from "@/lib/day-close-format";
import type { DayCloseListItem } from "@/types/day-close";

function cashDifference(value?: number) {
  if (value == null) return "Unavailable";
  if (Math.abs(value) <= 0.005) return "Matched";
  return `${formatDayCloseCurrency(Math.abs(value))} ${value < 0 ? "short" : "over"}`;
}

function statusLabel(status: string) {
  const normalized = String(status || "open").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

type DayCloseHistoryListCardProps = {
  item: DayCloseListItem;
  timezone?: string;
  onOpen: () => void;
  onClose?: () => void;
};

export function DayCloseHistoryListCard({
  item,
  timezone,
  onOpen,
  onClose,
}: DayCloseHistoryListCardProps) {
  const isOpen = String(item.status || "").toLowerCase() === "open";

  return (
    <div className="border-b border-border first:border-t">
      <button
        type="button"
        onClick={onOpen}
        className="grid min-h-[92px] w-full gap-3 py-4 text-left transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(190px,1fr)_minmax(130px,.65fr)_minmax(150px,.75fr)_auto] sm:items-center sm:px-3"
      >
        <div className="min-w-0">
          <p className="font-semibold">
            {formatDayCloseBusinessDate(
              item.business_date,
              timezone ?? item.timezone,
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatDayCloseCloseName(item.business_line)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sales</p>
          <p className="mt-0.5 font-medium tabular-nums">
            {formatDayCloseCurrency(item.net_sales)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cash difference</p>
          <p className="mt-0.5 font-medium tabular-nums">
            {cashDifference(item.cash_discrepancy)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="text-right">
            <p className="text-sm font-medium">{statusLabel(item.status)}</p>
            {item.confirmed_at ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Closed {new Date(item.confirmed_at).toLocaleString()}
              </p>
            ) : null}
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </button>
      {isOpen && onClose ? (
        <Button
          variant="outline"
          className="mb-3 h-11 w-full sm:ml-auto sm:w-auto"
          onClick={onClose}
        >
          Close this day
        </Button>
      ) : null}
    </div>
  );
}
