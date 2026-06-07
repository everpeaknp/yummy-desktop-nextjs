"use client";

import {
  Building2,
  Landmark,
  Receipt,
  RotateCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { DayCloseDetail, DayCloseSnapshotData } from "@/types/day-close";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import { snapshotFinancialSummaryRows } from "@/lib/day-close-snapshot-view";
import {
  DayCloseMetricCard,
  DC_METRIC_ACCENT_IN,
  DC_METRIC_ACCENT_OUT,
  DC_METRIC_ICON_IN,
  DC_METRIC_ICON_OUT,
  DC_METRIC_VALUE_IN,
  DC_METRIC_VALUE_OUT,
} from "@/components/analytics/day-close-metric-card";

type CashFlow = "in" | "out";

const FINANCIAL_SUMMARY_CARD: Record<
  string,
  { icon: typeof TrendingUp; flow: CashFlow }
> = {
  "Gross Sales": { icon: TrendingUp, flow: "in" },
  "Net Sales": { icon: Wallet, flow: "in" },
  "Total Income": { icon: TrendingUp, flow: "in" },
  Refunds: { icon: RotateCcw, flow: "out" },
  Expenses: { icon: Wallet, flow: "out" },
  "Credit Sales": { icon: Receipt, flow: "in" },
  "Credit Collection": { icon: TrendingUp, flow: "in" },
  Receivables: { icon: Building2, flow: "in" },
  Drawer: { icon: Landmark, flow: "in" },
};

const FINANCIAL_SUMMARY_PRIMARY = new Set([
  "Gross Sales",
  "Net Sales",
  "Total Income",
  "Refunds",
]);

const FINANCIAL_SUMMARY_SECONDARY = new Set([
  "Expenses",
  "Credit Sales",
  "Credit Collection",
  "Receivables",
  "Drawer",
]);

function FinancialSummaryCard({
  label,
  value,
  dense = false,
}: {
  label: string;
  value: number;
  dense?: boolean;
}) {
  const config = FINANCIAL_SUMMARY_CARD[label];
  const Icon = config?.icon;
  const isOut = config?.flow === "out";

  return (
    <DayCloseMetricCard
      compact
      dense={dense}
      label={label}
      value={formatDayCloseCurrency(value)}
      icon={Icon ? <Icon className={dense ? "h-3.5 w-3.5" : "h-4 w-4"} /> : undefined}
      iconPosition="top-right"
      iconClassName={isOut ? DC_METRIC_ICON_OUT : DC_METRIC_ICON_IN}
      accent={isOut ? DC_METRIC_ACCENT_OUT : DC_METRIC_ACCENT_IN}
      valueClassName={isOut ? DC_METRIC_VALUE_OUT : DC_METRIC_VALUE_IN}
      className="h-full min-w-0"
    />
  );
}

type DayCloseFinancialSummaryProps = {
  snapshot: DayCloseSnapshotData;
  detail?: DayCloseDetail | null;
  showTitle?: boolean;
  /** Tighter grid for day-close dialog minimized view */
  compact?: boolean;
};

export function DayCloseFinancialSummary({
  snapshot,
  detail,
  showTitle = true,
  compact = false,
}: DayCloseFinancialSummaryProps) {
  const rows = snapshotFinancialSummaryRows(snapshot, detail);
  if (rows.length === 0) return null;

  const primaryRows = rows.filter((row) => FINANCIAL_SUMMARY_PRIMARY.has(row.label));
  const secondaryRows = rows.filter((row) => FINANCIAL_SUMMARY_SECONDARY.has(row.label));

  if (compact) {
    return (
      <section className="space-y-3">
        {showTitle ? <h4 className="dc-section-title">Financial Summary</h4> : null}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 items-stretch pt-1">
          {rows.map((row) => (
            <FinancialSummaryCard
              key={row.label}
              label={row.label}
              value={row.value!}
              dense
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {showTitle ? <h4 className="dc-section-title">Financial Summary</h4> : null}
      <div className="space-y-4">
        {primaryRows.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch pt-1">
            {primaryRows.map((row) => (
              <FinancialSummaryCard key={row.label} label={row.label} value={row.value!} />
            ))}
          </div>
        ) : null}
        {secondaryRows.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 items-stretch pt-1">
            {secondaryRows.map((row) => (
              <FinancialSummaryCard key={row.label} label={row.label} value={row.value!} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
