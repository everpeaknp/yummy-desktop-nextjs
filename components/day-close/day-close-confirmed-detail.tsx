"use client";

import Link from "next/link";
import { ChevronDown, Download, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  formatDayCloseBusinessDate,
  formatDayCloseCurrency,
  formatDayClosePeriod,
  formatDayCloseCloseName,
  getDayClosePeriodContext,
} from "@/lib/day-close-format";
import { getAnalyticsUrlForDayClose } from "@/lib/day-close-navigation";
import type { DayCloseDetail, DayCloseSnapshotData } from "@/types/day-close";
import {
  DayCloseFinancialDetails,
  FinancialDetailsButton,
} from "@/components/day-close/day-close-financial-details";
import { useState } from "react";
import type { ReactNode } from "react";

function value(value?: number | null) {
  return value == null ? "Unavailable" : formatDayCloseCurrency(value);
}

function difference(value?: number | null) {
  if (value == null) return "Unavailable";
  if (Math.abs(value) <= 0.005) return "Matched";
  return `${formatDayCloseCurrency(Math.abs(value))} ${value < 0 ? "short" : "over"}`;
}

function Row({
  label,
  value: rowValue,
  exception = false,
}: {
  label: string;
  value: ReactNode;
  exception?: boolean;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right font-semibold tabular-nums",
          exception && "text-destructive",
        )}
      >
        {rowValue}
      </dd>
    </div>
  );
}

export function DayCloseConfirmedDetail({
  detail,
  snapshot,
  timezone,
  closedBy,
  canAdjust,
  canReopen,
  onAddCorrection,
  onReopen,
  onExportPdf,
  onExportExcel,
}: {
  detail: DayCloseDetail;
  snapshot?: DayCloseSnapshotData | null;
  timezone?: string;
  closedBy?: string | null;
  canAdjust: boolean;
  canReopen: boolean;
  onAddCorrection?: () => void;
  onReopen?: () => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
}) {
  const [financialOpen, setFinancialOpen] = useState(false);
  const financial =
    snapshot?.evidence?.financial ?? snapshot?.financial_summary;
  const drawer = snapshot?.evidence?.drawers ?? snapshot?.drawer_control;
  const counted = drawer?.counted_cash ?? detail.counted_cash;
  const expected = drawer?.expected_cash ?? detail.expected_cash;
  const variance = drawer?.cash_variance ?? detail.cash_discrepancy;
  const status = String(detail.status || "confirmed");
  const resolvedClosedBy = closedBy || "Unavailable";
  const periodContext = getDayClosePeriodContext(
    detail.period_start_at,
    detail.period_end_at,
  );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <main className="space-y-8">
          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {formatDayCloseCloseName(detail.business_line)}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {formatDayCloseBusinessDate(detail.business_date, timezone)}
                </h2>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  status.toLowerCase() === "confirmed"
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-amber-500/10 text-amber-700",
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Activity included:{" "}
              {formatDayClosePeriod(
                detail.period_start_at,
                detail.period_end_at,
                timezone,
              )}
            </p>
            {periodContext.durationLabel ? (
              <p className="mt-1 text-sm font-medium">
                {periodContext.durationLabel}
              </p>
            ) : null}
            {periodContext.isMultiDay ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Includes activity since the previous confirmed close.
              </p>
            ) : null}
          </section>

          <section>
            <h3 className="text-lg font-semibold">Financial summary</h3>
            <dl className="mt-2 divide-y border-y border-border">
              <Row
                label="Sales"
                value={value(financial?.net_sales ?? detail.net_sales)}
              />
              <Row
                label="Payments collected"
                value={value(financial?.collections_total)}
              />
              <Row
                label="Credit sales"
                value={value(financial?.credit_sales ?? detail.credit_sales)}
              />
              <Row
                label="Refunds"
                value={value(financial?.refund_total ?? detail.refund_total)}
              />
              <Row
                label="Expenses"
                value={value(financial?.expense_total ?? detail.expense_total)}
              />
            </dl>
            <FinancialDetailsButton onClick={() => setFinancialOpen(true)} />
          </section>

          <section>
            <h3 className="text-lg font-semibold">Cash reconciliation</h3>
            <dl className="mt-2 divide-y border-y border-border">
              <Row label="Cash the system expects" value={value(expected)} />
              <Row
                label="Cash counted"
                value={counted == null ? "Not counted" : value(counted)}
              />
              <Row
                label="Cash difference"
                value={difference(variance)}
                exception={variance != null && Math.abs(variance) > 0.005}
              />
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              {detail.cash_count_source === "drawer_evidence"
                ? "Counted from cash drawers"
                : detail.cash_count_source === "manual_count"
                  ? "Manually counted"
                  : "Not counted"}
            </p>
          </section>
        </main>

        <aside className="space-y-6 lg:sticky lg:top-6">
          <section>
            <h3 className="font-semibold">Close details</h3>
            <dl className="mt-2 divide-y border-y border-border">
              <Row
                label="Business line"
                value={formatDayCloseCloseName(detail.business_line)}
              />
              <Row label="Closed by" value={resolvedClosedBy} />
              <Row
                label="Closed at"
                value={
                  detail.confirmed_at
                    ? new Date(detail.confirmed_at).toLocaleString()
                    : "Unavailable"
                }
              />
            </dl>
            {detail.confirmation_notes ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {detail.confirmation_notes}
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <Button asChild variant="outline" className="h-11 w-full">
              <Link href={getAnalyticsUrlForDayClose(detail)}>
                View in Analytics
              </Link>
            </Button>
            {onExportPdf || onExportExcel ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 w-full">
                    Export <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {onExportPdf ? (
                    <DropdownMenuItem onSelect={onExportPdf}>
                      <Download className="mr-2 h-4 w-4" />
                      Summary PDF
                    </DropdownMenuItem>
                  ) : null}
                  {onExportExcel ? (
                    <DropdownMenuItem onSelect={onExportExcel}>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Detailed Excel
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {canAdjust && onAddCorrection ? (
              <Button
                variant="ghost"
                className="h-11 w-full"
                onClick={onAddCorrection}
              >
                Add correction
              </Button>
            ) : null}
            {canReopen && onReopen ? (
              <Button
                variant="ghost"
                className="h-11 w-full text-amber-700"
                onClick={onReopen}
              >
                Reopen latest close
              </Button>
            ) : null}
          </section>
        </aside>
      </div>

      <DayCloseFinancialDetails
        open={financialOpen}
        onOpenChange={setFinancialOpen}
        snapshot={snapshot}
        detail={detail}
      />
    </div>
  );
}
