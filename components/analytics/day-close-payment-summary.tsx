"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import {
  buildPaymentSummary,
  filterPaymentSummaryLinesWithReceipts,
  type PaymentSummaryLine,
} from "@/lib/day-close-payment-summary";

type DayClosePaymentSummaryProps = {
  detail?: unknown;
  snapshotData?: unknown;
  title?: string;
  showBars?: boolean;
  className?: string;
};

export function DayClosePaymentSummary({
  detail,
  snapshotData,
  title = "Payment methods",
  showBars = true,
  className,
}: DayClosePaymentSummaryProps) {
  const lines = useMemo(
    () => buildPaymentSummary(detail, snapshotData),
    [detail, snapshotData],
  );

  const maxAmount = useMemo(() => {
    if (lines.length === 0) return 1;
    return Math.max(...lines.map((line) => line.amount), 1);
  }, [lines]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 bg-muted/5">
          <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em]">
            {title}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Values from the saved day-close snapshot only.
          </p>
        </div>
        {lines.length === 0 ? (
          <div className="px-5 py-6 text-sm font-semibold text-muted-foreground text-center">
            Payment breakdown is not available in this snapshot.
          </div>
        ) : (
          lines.map((line) => (
            <PaymentSummaryRow
              key={line.key}
              line={line}
              maxAmount={maxAmount}
              showBar={showBars}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PaymentSummaryRow({
  line,
  maxAmount,
  showBar,
}: {
  line: PaymentSummaryLine;
  maxAmount: number;
  showBar: boolean;
}) {
  const widthPct = maxAmount > 0 ? Math.max(4, (line.amount / maxAmount) * 100) : 0;

  return (
    <div className="px-5 py-3 border-b border-border/30 last:border-none">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-muted-foreground">{line.label}</p>
        <p className="text-sm font-black text-foreground tabular-nums whitespace-nowrap">
          {formatDayCloseCurrency(line.amount)}
        </p>
      </div>
      {showBar && line.amount > 0 ? (
        <div className="mt-2 h-2 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500/80 dark:bg-blue-400/80 transition-all"
            style={{ width: `${widthPct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function downloadPaymentSummaryCsv(
  lines: PaymentSummaryLine[],
  businessDate: string,
) {
  const nonZeroLines = filterPaymentSummaryLinesWithReceipts(lines);
  const rows = [
    ["Payment Method", "Amount (NPR)"],
    ...nonZeroLines.map((line) => [line.label, line.amount.toFixed(2)]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `day_close_payments_${businessDate || "summary"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
