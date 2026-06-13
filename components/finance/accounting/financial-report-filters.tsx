"use client";

import { ReactNode } from "react";
import { Download, RefreshCw } from "lucide-react";

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

export type DatePreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";
export type AccountingReportBasis = "posted_journals" | "finance_events" | "both";

export const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom" },
];

type FinancialReportFiltersProps = {
  dateFrom: string;
  dateTo: string;
  station?: string;
  businessLine?: string;
  reportBasis?: AccountingReportBasis;
  datePreset?: DatePreset;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
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
  station = "",
  businessLine = "restaurant",
  reportBasis = "posted_journals",
  datePreset = "custom",
  onDateFromChange,
  onDateToChange,
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
            <Label className="text-xs text-muted-foreground">Preset</Label>
            <Select value={datePreset} onValueChange={(value) => onDatePresetChange?.(value as DatePreset)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
