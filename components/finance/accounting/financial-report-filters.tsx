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
import { ReportFilters } from "@/components/reports/report-filters";

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
    <div className="space-y-2">
      <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Active scope</div>
          <div className="truncate text-xs font-medium text-foreground sm:text-sm">{activeScope}</div>
        </div>
        {onReset && (
          <Button variant="ghost" className="h-9 shrink-0 rounded-lg px-2.5 text-xs" onClick={onReset}>
            Reset filters
          </Button>
        )}
      </div>
      <ReportFilters
        title="Report filters"
        activeCount={Number(Boolean(station)) + Number(businessLine !== "restaurant") + Number(reportBasis !== "posted_journals")}
      >
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 md:flex md:flex-wrap md:items-end">
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
              className="h-11 w-full rounded-xl md:w-auto"
            />
          </div>
          {onBusinessLineChange && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Business line</Label>
              <Select value={businessLine || "restaurant"} onValueChange={onBusinessLineChange}>
                <SelectTrigger className="h-11 w-full rounded-xl md:w-[150px]">
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
                <SelectTrigger className="h-11 w-full rounded-xl md:w-[170px]">
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
                className="h-11 w-full rounded-xl md:w-[180px]"
              />
              <p className="text-[11px] text-muted-foreground">
                Optional source station filter, like `bar` or `frontdesk`. Enter `mixed` for Unassigned / mixed station.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <Button variant="outline" className="h-11 rounded-xl" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
          {onExport && (
            <Button variant="outline" className="h-11 rounded-xl" onClick={onExport} disabled={exportDisabled}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>
      </ReportFilters>
    </div>
  );
}
