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
import { DayCloseMetricCard } from "@/components/analytics/day-close-metric-card";

const FINANCIAL_SUMMARY_CARD = {
  "Gross Sales": {
    icon: TrendingUp,
    accent: "from-slate-500/50 to-slate-500/10",
    iconClassName:
      "border-slate-200 bg-slate-50 text-slate-600 group-hover:border-slate-300 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300 dark:group-hover:border-slate-400/60",
  },
  "Net Sales": {
    icon: Wallet,
    accent: "from-emerald-500/50 to-emerald-500/10",
    valueClassName: "text-emerald-600 dark:text-emerald-400",
    iconClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-600 group-hover:border-emerald-300 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-400 dark:group-hover:border-emerald-400/60",
  },
  "Total Income": {
    icon: TrendingUp,
    accent: "from-teal-500/50 to-teal-500/10",
    valueClassName: "text-teal-600 dark:text-teal-400",
    iconClassName:
      "border-teal-200 bg-teal-50 text-teal-600 group-hover:border-teal-300 dark:border-teal-500/40 dark:bg-teal-500/15 dark:text-teal-400 dark:group-hover:border-teal-400/60",
  },
  Refunds: {
    icon: RotateCcw,
    accent: "from-rose-500/50 to-rose-500/10",
    valueClassName: "text-rose-600 dark:text-rose-400",
    iconClassName:
      "border-rose-200 bg-rose-50 text-rose-600 group-hover:border-rose-300 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-400 dark:group-hover:border-rose-400/60",
  },
  Expenses: {
    icon: Wallet,
    accent: "from-destructive/50 to-destructive/10",
    valueClassName: "text-destructive",
    iconClassName:
      "border-red-200 bg-red-50 text-red-600 group-hover:border-red-300 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-400 dark:group-hover:border-red-400/60",
  },
  "Credit Sales": {
    icon: Receipt,
    accent: "from-violet-500/50 to-violet-500/10",
    iconClassName:
      "border-violet-200 bg-violet-50 text-violet-600 group-hover:border-violet-300 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-400 dark:group-hover:border-violet-400/60",
  },
  "Credit Collection": {
    icon: TrendingUp,
    accent: "from-cyan-500/50 to-cyan-500/10",
    valueClassName: "text-cyan-600 dark:text-cyan-400",
    iconClassName:
      "border-cyan-200 bg-cyan-50 text-cyan-600 group-hover:border-cyan-300 dark:border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-400 dark:group-hover:border-cyan-400/60",
  },
  Receivables: {
    icon: Building2,
    accent: "from-orange-500/50 to-orange-500/10",
    valueClassName: "text-orange-600 dark:text-orange-400",
    iconClassName:
      "border-orange-200 bg-orange-50 text-orange-600 group-hover:border-orange-300 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-400 dark:group-hover:border-orange-400/60",
  },
  Drawer: {
    icon: Landmark,
    accent: "from-amber-500/50 to-amber-500/10",
    valueClassName: "text-amber-700 dark:text-amber-400",
    iconClassName:
      "border-amber-200 bg-amber-50 text-amber-700 group-hover:border-amber-300 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400 dark:group-hover:border-amber-400/60",
  },
} as const;

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
}: {
  label: string;
  value: number;
}) {
  const config = FINANCIAL_SUMMARY_CARD[label as keyof typeof FINANCIAL_SUMMARY_CARD];
  const Icon = config?.icon;

  return (
    <DayCloseMetricCard
      compact
      label={label}
      value={formatDayCloseCurrency(value)}
      icon={Icon ? <Icon className="h-4 w-4" /> : undefined}
      iconClassName={config?.iconClassName}
      accent={config?.accent}
      valueClassName={
        config && "valueClassName" in config ? config.valueClassName : undefined
      }
      className="h-full min-w-0"
    />
  );
}

type DayCloseFinancialSummaryProps = {
  snapshot: DayCloseSnapshotData;
  detail?: DayCloseDetail | null;
  showTitle?: boolean;
};

export function DayCloseFinancialSummary({
  snapshot,
  detail,
  showTitle = true,
}: DayCloseFinancialSummaryProps) {
  const rows = snapshotFinancialSummaryRows(snapshot, detail);
  if (rows.length === 0) return null;

  const primaryRows = rows.filter((row) => FINANCIAL_SUMMARY_PRIMARY.has(row.label));
  const secondaryRows = rows.filter((row) => FINANCIAL_SUMMARY_SECONDARY.has(row.label));

  return (
    <section className="space-y-3">
      {showTitle ? <h4 className="dc-section-title">Financial Summary</h4> : null}
      <div className="space-y-4">
        {primaryRows.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
            {primaryRows.map((row) => (
              <FinancialSummaryCard key={row.label} label={row.label} value={row.value!} />
            ))}
          </div>
        ) : null}
        {secondaryRows.length > 0 ? (
          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <div className="grid grid-cols-5 gap-3 sm:gap-4 min-w-[640px] items-stretch">
              {secondaryRows.map((row) => (
                <FinancialSummaryCard key={row.label} label={row.label} value={row.value!} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
