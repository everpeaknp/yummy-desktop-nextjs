"use client";

import { ReactNode } from "react";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FinancialReportFiltersProps = {
  dateFrom: string;
  dateTo: string;
  station?: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onStationChange?: (value: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  onExport?: () => void;
  exportDisabled?: boolean;
  actions?: ReactNode;
};

export function FinancialReportFilters({
  dateFrom,
  dateTo,
  station = "",
  onDateFromChange,
  onDateToChange,
  onStationChange,
  onRefresh,
  refreshing,
  onExport,
  exportDisabled,
  actions,
}: FinancialReportFiltersProps) {
  return (
    <div className="flex flex-col gap-3 border-y border-border bg-muted/20 px-4 py-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="accounting-date-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="accounting-date-from"
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-9 w-[150px]"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="accounting-date-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="accounting-date-to"
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="h-9 w-[150px]"
          />
        </div>
        {onStationChange && (
          <div className="grid gap-1.5">
            <Label htmlFor="accounting-station" className="text-xs text-muted-foreground">
              Station
            </Label>
            <Input
              id="accounting-station"
              value={station}
              onChange={(event) => onStationChange(event.target.value)}
              placeholder="All stations"
              className="h-9 w-[180px]"
              list="accounting-station-options"
            />
            <datalist id="accounting-station-options">
              <option value="__unassigned__">Unassigned / mixed station</option>
            </datalist>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
          Refresh
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport} disabled={exportDisabled}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}
      </div>
    </div>
  );
}
