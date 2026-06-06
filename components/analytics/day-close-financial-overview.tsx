"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  DollarSign,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import type { DayCloseSnapshotData } from "@/types/day-close";
import { formatDayCloseCurrency, pickBackendAmount } from "@/lib/day-close-format";
import {
  snapshotExpenseRows,
  snapshotMetricRows,
  snapshotPaymentMethodRows,
  snapshotRefundRows,
} from "@/lib/day-close-snapshot-view";
import { DayCloseMetricCard } from "@/components/analytics/day-close-metric-card";
import { DayCloseBreakdownSheet } from "@/components/analytics/day-close-breakdown-sheet";
import { DayClosePaymentMethodsCard } from "@/components/analytics/day-close-payment-methods-card";
import { DayCloseReceivablesSection } from "@/components/analytics/day-close-receivables-section";
import { cn } from "@/lib/utils";

export type DayCloseBreakdownKey =
  | "sales"
  | "expenses"
  | "cash"
  | "payments"
  | "refunds"
  | "receivables";

type DayCloseFinancialOverviewProps = {
  snapshot: DayCloseSnapshotData | null;
  loading?: boolean;
  className?: string;
};

function EmptyFinancials() {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 px-6 py-12 text-center">
      <p className="text-sm font-medium text-foreground">Financial snapshot unavailable</p>
      <p className="text-xs text-muted-foreground mt-1">
        Refresh the page or check your connection. Totals are loaded from the backend day-close
        service only.
      </p>
    </div>
  );
}

export function DayCloseFinancialOverview({
  snapshot,
  loading = false,
  className,
}: DayCloseFinancialOverviewProps) {
  const [sheet, setSheet] = useState<DayCloseBreakdownKey | null>(null);

  const cards = useMemo(() => {
    if (!snapshot) return [];
    const receivables = snapshot.receivables;
    return [
      {
        key: "sales" as const,
        label: "Net Sales",
        value: formatDayCloseCurrency(pickBackendAmount(snapshot.net_sales)),
        icon: <DollarSign className="h-4 w-4" />,
        accent: "from-emerald-500/50 to-emerald-500/10",
        hint: "Backend net sales for the current close window",
      },
      {
        key: "expenses" as const,
        label: "Total Expenses",
        value: formatDayCloseCurrency(pickBackendAmount(snapshot.expense_total)),
        icon: <Wallet className="h-4 w-4" />,
        accent: "from-destructive/50 to-destructive/10",
        hint: "Expenses recorded in this close window",
      },
      {
        key: "cash" as const,
        label: "Expected Cash",
        value: formatDayCloseCurrency(pickBackendAmount(snapshot.expected_cash)),
        icon: <Banknote className="h-4 w-4" />,
        accent: "from-primary/50 to-primary/10",
        hint: "Cash you should have on hand per backend reconciliation",
      },
      {
        key: "payments" as const,
        label: "Total Income",
        value: formatDayCloseCurrency(pickBackendAmount(snapshot.total_income, snapshot.net_sales)),
        icon: <Receipt className="h-4 w-4" />,
        accent: "from-violet-500/50 to-violet-500/10",
        hint: "Payment methods and instrument breakdown",
      },
      {
        key: "refunds" as const,
        label: "Refunds",
        value: formatDayCloseCurrency(pickBackendAmount(snapshot.refunds?.total)),
        icon: <RotateCcw className="h-4 w-4" />,
        accent: "from-orange-500/50 to-orange-500/10",
        hint: "Refunds processed in this window",
      },
      {
        key: "receivables" as const,
        label: "Outstanding Receivables",
        value: formatDayCloseCurrency(pickBackendAmount(receivables?.outstanding_receivables)),
        icon: <CreditCard className="h-4 w-4" />,
        accent: "from-blue-500/50 to-blue-500/10",
        hint: "Tap to see credit orders and collection detail",
      },
    ];
  }, [snapshot]);

  const sheetContent = useMemo(() => {
    if (!snapshot || !sheet) return null;

    switch (sheet) {
      case "sales": {
        const metrics = snapshotMetricRows(snapshot).filter((row) =>
          ["Gross Sales", "Net Sales", "Total Income", "Total Orders", "Avg Order Value"].includes(
            row.label,
          ),
        );
        return (
          <div className="space-y-3">
            {metrics.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/10 px-4 py-3"
              >
                <span className="text-sm font-medium">{row.label}</span>
                <span className="font-bold tabular-nums">
                  {row.label.includes("Orders") || row.label.includes("Avg")
                    ? row.value?.toLocaleString() ?? "—"
                    : formatDayCloseCurrency(row.value)}
                </span>
              </div>
            ))}
          </div>
        );
      }
      case "expenses": {
        const rows = snapshotExpenseRows(snapshot);
        if (rows.length === 0) {
          return (
            <p className="text-sm text-muted-foreground">
              No expense breakdown in this snapshot. Total:{" "}
              {formatDayCloseCurrency(snapshot.expense_total)}
            </p>
          );
        }
        return (
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div
                key={`${row.label}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3"
              >
                <span className="text-sm font-medium">{row.label}</span>
                <span className="font-bold text-rose-600 tabular-nums">
                  {formatDayCloseCurrency(row.amount)}
                </span>
              </div>
            ))}
          </div>
        );
      }
      case "cash": {
        const cashRows = snapshotMetricRows(snapshot).filter((row) =>
          ["Expected Cash", "Cash Collected", "Manual Income"].includes(row.label),
        );
        return (
          <div className="space-y-3">
            {cashRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/10 px-4 py-3"
              >
                <span className="text-sm font-medium">{row.label}</span>
                <span className="font-bold tabular-nums">{formatDayCloseCurrency(row.value)}</span>
              </div>
            ))}
          </div>
        );
      }
      case "payments":
        return (
          <DayClosePaymentMethodsCard
            title="Payment Methods"
            rows={snapshotPaymentMethodRows(snapshot)}
          />
        );
      case "refunds": {
        const rows = snapshotRefundRows(snapshot);
        if (rows.length === 0) {
          return <p className="text-sm text-muted-foreground">No refunds in this close window.</p>;
        }
        return (
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div
                key={`${row.label}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{row.label}</p>
                  {row.secondary ? (
                    <p className="text-[11px] text-muted-foreground">{row.secondary}</p>
                  ) : null}
                </div>
                <span className="font-bold tabular-nums">{formatDayCloseCurrency(row.amount)}</span>
              </div>
            ))}
          </div>
        );
      }
      case "receivables":
        return <DayCloseReceivablesSection snapshot={snapshot} compact />;
      default:
        return null;
    }
  }, [sheet, snapshot]);

  const sheetTitle: Record<DayCloseBreakdownKey, string> = {
    sales: "Sales Summary",
    expenses: "Expense Breakdown",
    cash: "Cash Reconciliation Preview",
    payments: "Payment Breakdown",
    refunds: "Refund Breakdown",
    receivables: "Receivables Detail",
  };

  if (loading) {
    return (
      <div className={cn("grid grid-cols-2 lg:grid-cols-3 gap-4", className)}>
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="h-[120px] rounded-2xl border border-border/40 bg-muted/20 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!snapshot) return <EmptyFinancials />;

  return (
    <>
      <section className={cn("space-y-8", className)}>
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Financial Overview
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            All values come from the backend snapshot. Select a card to view the full breakdown.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <DayCloseMetricCard
                key={card.key}
                label={card.label}
                value={card.value}
                icon={card.icon}
                accent={card.accent}
                hint={card.hint}
                onClick={() => setSheet(card.key)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Receivables
            </h2>
          </div>
          <DayCloseReceivablesSection snapshot={snapshot} />
        </div>
      </section>

      <DayCloseBreakdownSheet
        open={sheet != null}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        title={sheet ? sheetTitle[sheet] : ""}
        description="Backend snapshot data — no browser-side calculations."
      >
        {sheetContent}
      </DayCloseBreakdownSheet>
    </>
  );
}
