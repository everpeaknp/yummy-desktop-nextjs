"use client";

import { ReactNode } from "react";
import { Download, RefreshCw } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DateRangeDropdown,
  type DateRangePreset,
} from "@/components/ui/date-range-dropdown";

export type DatePreset = DateRangePreset;
export type AccountingReportBasis = "posted_journals" | "finance_events" | "both";

type FinancialReportFiltersProps = {
  dateFrom: string;
  dateTo: string;
  dateRange?: DateRange | undefined;
  station?: string;
  businessLine?: string;
  reportBasis?: AccountingReportBasis;
  datePreset?: DatePreset;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onDateRangeChange?: (value: DateRange | undefined) => void;
  onStationChange?: (value: string) => void;
  onBusinessLineChange?: (value: string) => void;
  onReportBasisChange?: (value: AccountingReportBasis) => void;
  onDatePresetChange?: (value: DatePreset) => void;
  onReset?: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  onExport?: () => void;
  exportDisabled?: boolean;
  actions?: ReactNode;
};

export function FinancialReportFilters({
  dateFrom,
  dateTo,
  dateRange,
  station = "",
  businessLine = "restaurant",
  reportBasis = "posted_journals",
  datePreset = "custom",
  onDateFromChange,
  onDateToChange,
  onDateRangeChange,
  onStationChange,
  onBusinessLineChange,
  onReportBasisChange,
  onDatePresetChange,
  onReset,
  onRefresh,
  refreshing,
  onExport,
  exportDisabled,
  actions,
}: FinancialReportFiltersProps) {
  const reportBasisLabel =
    reportBasis === "finance_events" ? "Finance events" : reportBasis === "both" ? "Both" : "Posted journals";
  const activeScope = `${dateFrom} to ${dateTo} | ${businessLine || "restaurant"} | ${
    station || "All stations"
  } | ${reportBasisLabel}`;

  return (
    <div className="flex flex-col gap-3 border-y border-border bg-background px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active scope</div>
          <div className="text-sm font-medium text-foreground">{activeScope}</div>
        </div>
        {onReset && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Reset filters
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Date range</Label>
            <DateRangeDropdown
              activeRange={datePreset}
              setActiveRange={(value) => onDatePresetChange?.(value)}
              date={dateRange}
              setDate={(value) => {
                onDateRangeChange?.(value);
                const from = value?.from;
                const to = value?.to;
                if (from) {
                  const year = from.getFullYear();
                  const month = String(from.getMonth() + 1).padStart(2, "0");
                  const day = String(from.getDate()).padStart(2, "0");
                  onDateFromChange(`${year}-${month}-${day}`);
                }
                if (to) {
                  const year = to.getFullYear();
                  const month = String(to.getMonth() + 1).padStart(2, "0");
                  const day = String(to.getDate()).padStart(2, "0");
                  onDateToChange(`${year}-${month}-${day}`);
                } else if (from) {
                  const year = from.getFullYear();
                  const month = String(from.getMonth() + 1).padStart(2, "0");
                  const day = String(from.getDate()).padStart(2, "0");
                  onDateToChange(`${year}-${month}-${day}`);
                }
              }}
            />
          </div>
          {onBusinessLineChange && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Business line</Label>
              <Select value={businessLine || "restaurant"} onValueChange={onBusinessLineChange}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="hotel">Hotel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {onReportBasisChange && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Report basis</Label>
              <Select
                value={reportBasis}
                onValueChange={(value) => onReportBasisChange(value as AccountingReportBasis)}
              >
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="posted_journals">Posted journals</SelectItem>
                  <SelectItem value="finance_events">Finance events</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {onStationChange && (
            <div className="grid gap-1.5">
              <Label htmlFor="accounting-station" className="text-xs text-muted-foreground">
                Station
              </Label>
              <Input
                id="accounting-station"
                value={station}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => onStationChange(event.target.value)}
                placeholder="Leave blank for all stations"
                className="h-9 w-[180px]"
              />
              <p className="text-[11px] text-muted-foreground">
                Optional source station filter, like `bar` or `frontdesk`.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} disabled={exportDisabled}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
