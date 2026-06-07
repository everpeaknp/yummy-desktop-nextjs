"use client";

import {
  CircleDollarSign,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { DayCloseSnapshotData } from "@/types/day-close";
import { formatDayCloseCurrency, formatDayCloseNumber } from "@/lib/day-close-format";
import { snapshotFinancialSummaryRows } from "@/lib/day-close-snapshot-view";
import { DayCloseMetricCard } from "@/components/analytics/day-close-metric-card";

const FINANCIAL_SUMMARY_CARD = {
  "Total Income": {
    icon: TrendingUp,
    accent: "from-emerald-500/50 to-emerald-500/10",
    valueClassName: "text-emerald-600 dark:text-emerald-400",
    iconClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-600 group-hover:border-emerald-300 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-400 dark:group-hover:border-emerald-400/60",
  },
  "Manual Income": {
    icon: CircleDollarSign,
    accent: "from-blue-500/50 to-blue-500/10",
    iconClassName:
      "border-blue-200 bg-blue-50 text-blue-600 group-hover:border-blue-300 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-400 dark:group-hover:border-blue-400/60",
  },
  "Total Orders": {
    icon: Receipt,
    accent: "from-amber-500/50 to-amber-500/10",
    iconClassName:
      "border-amber-200 bg-amber-50 text-amber-600 group-hover:border-amber-300 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400 dark:group-hover:border-amber-400/60",
  },
  "Total Expenses": {
    icon: Wallet,
    accent: "from-destructive/50 to-destructive/10",
    valueClassName: "text-destructive",
    iconClassName:
      "border-red-200 bg-red-50 text-red-600 group-hover:border-red-300 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-400 dark:group-hover:border-red-400/60",
  },
} as const;

function formatFinancialSummaryValue(label: string, value: number): string {
  if (label === "Total Orders") return formatDayCloseNumber(value);
  return formatDayCloseCurrency(value);
}

type DayCloseFinancialSummaryProps = {
  snapshot: DayCloseSnapshotData;
};

export function DayCloseFinancialSummary({ snapshot }: DayCloseFinancialSummaryProps) {
  const rows = snapshotFinancialSummaryRows(snapshot);
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <h4 className="dc-section-title">Financial Summary</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rows.map((row) => {
          const config =
            FINANCIAL_SUMMARY_CARD[row.label as keyof typeof FINANCIAL_SUMMARY_CARD];
          const Icon = config?.icon;

          return (
            <DayCloseMetricCard
              key={row.label}
              compact
              label={row.label}
              value={formatFinancialSummaryValue(row.label, row.value!)}
              icon={Icon ? <Icon className="h-4 w-4" /> : undefined}
              iconClassName={config?.iconClassName}
              accent={config?.accent}
              valueClassName={config?.valueClassName}
            />
          );
        })}
      </div>
    </section>
  );
}
