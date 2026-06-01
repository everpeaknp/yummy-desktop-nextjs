"use client";

import { useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/api-client";
import { RestaurantApis } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import {
  buildPaymentSummary,
  filterPaymentSummaryLinesWithReceipts,
  paymentSummaryBucketGrandTotal,
  paymentSummaryGrandTotal,
  paymentSummaryHasUnrecordedInstruments,
  resolveManualIncomeTotal,
  resolveNetSalesAmount,
  type PaymentSummaryLine,
} from "@/lib/day-close-payment-summary";

type DayClosePaymentSummaryProps = {
  detail?: unknown;
  snapshotData?: unknown;
  restaurant?: unknown;
  restaurantId?: number;
  title?: string;
  subtitle?: string;
  showBars?: boolean;
  className?: string;
  /** When set, footer can explain differences vs Net Sales. */
  netSales?: number;
};

function formatRs(amount: number) {
  return `Rs. ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Load payment_qrs / fonepay / payment_cards without toggling global restaurant loading. */
function useRestaurantPaymentProfile(restaurant?: unknown, restaurantId?: number) {
  const [profile, setProfile] = useState<unknown>(restaurant ?? null);

  useEffect(() => {
    setProfile(restaurant ?? null);
  }, [restaurant]);

  useEffect(() => {
    const id =
      restaurantId ??
      (restaurant && typeof restaurant === "object"
        ? Number((restaurant as Record<string, unknown>).id)
        : undefined);

    if (!id || !Number.isFinite(id)) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await apiClient.get(RestaurantApis.getById(id));
        if (!cancelled && res.data?.status === "success") {
          setProfile(res.data.data);
        }
      } catch {
        // Keep cached restaurant profile from the store.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, restaurant]);

  return profile;
}

export function DayClosePaymentSummary({
  detail,
  snapshotData,
  restaurant,
  restaurantId,
  title = "Payment totals",
  subtitle,
  showBars = true,
  className,
  netSales: netSalesProp,
}: DayClosePaymentSummaryProps) {
  const paymentProfile = useRestaurantPaymentProfile(restaurant, restaurantId);

  const lines = useMemo(() => {
    try {
      return buildPaymentSummary(detail, snapshotData, paymentProfile);
    } catch (error) {
      console.error("[DayClosePaymentSummary] Failed to build payment summary", error);
      return buildPaymentSummary(detail, snapshotData);
    }
  }, [detail, snapshotData, paymentProfile]);

  const paymentTotals = useMemo(
    () => paymentSummaryBucketGrandTotal(detail, snapshotData),
    [detail, snapshotData],
  );
  const channelRowsTotal = useMemo(() => paymentSummaryGrandTotal(lines), [lines]);
  const netSales = useMemo(
    () =>
      netSalesProp != null && Number.isFinite(netSalesProp)
        ? netSalesProp
        : resolveNetSalesAmount(detail, snapshotData),
    [detail, netSalesProp, snapshotData],
  );
  const manualIncome = useMemo(() => resolveManualIncomeTotal(snapshotData), [snapshotData]);
  const hasUnrecordedQrCard = useMemo(
    () => paymentSummaryHasUnrecordedInstruments(lines),
    [lines],
  );
  const maxAmount = useMemo(
    () => Math.max(...lines.map((line) => line.amount), paymentTotals, 1),
    [lines, paymentTotals],
  );

  return (
    <div className={cn("space-y-4", className)}>
      {subtitle ? (
        <p className="text-xs text-muted-foreground font-semibold px-1">{subtitle}</p>
      ) : null}

      <div className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/40 bg-muted/5">
          <p className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-[0.18em]">
            Payment channels received
          </p>
        </div>
        {lines.length === 0 ? (
          <div className="px-5 py-6 text-sm font-semibold text-muted-foreground text-center">
            No payments recorded for this day.
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
        <div className="px-5 py-4 border-t border-border/40 bg-muted/20 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-foreground">{title}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                Cash + card + QR + Fonepay + credit on orders
              </p>
            </div>
            <p className="text-sm font-black text-foreground tabular-nums">{formatRs(paymentTotals)}</p>
          </div>
          {Math.abs(channelRowsTotal - paymentTotals) > 0.02 ? (
            <p className="text-[11px] text-muted-foreground">
              Channel lines sum to {formatRs(channelRowsTotal)}; day-close buckets total{" "}
              {formatRs(paymentTotals)}.
            </p>
          ) : null}
          {netSales > 0 &&
          Math.abs(paymentTotals - netSales) > 0.01 &&
          manualIncome > 0.01 ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Net Sales is {formatRs(netSales)} (order revenue). Payment totals can differ when manual
              income ({formatRs(manualIncome)}) is recorded separately.
            </p>
          ) : hasUnrecordedQrCard ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              QR and card rows from Settings are listed, but this day&apos;s payments were saved
              without a bank/terminal name (Rs. 0 on each bank). New checkouts must pick the static QR
              or card on the payment screen so amounts appear under Himalayan Bank, Nabil bank, etc.
            </p>
          ) : netSales > 0 && paymentTotals > netSales + 0.01 ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Net Sales is {formatRs(netSales)}. Use Load Snapshot so per-bank QR/card amounts match
              checkout instrument names.
            </p>
          ) : netSales > 0 && netSales > paymentTotals + 0.01 ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Net Sales is {formatRs(netSales)}. Payment totals are lower when some order value is
              still on credit or not yet collected.
            </p>
          ) : null}
        </div>
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
          {formatRs(line.amount)}
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
  const grandTotal = paymentSummaryGrandTotal(nonZeroLines);
  const rows = [
    ["Payment Method", "Amount (NPR)"],
    ...nonZeroLines.map((line) => [line.label, line.amount.toFixed(2)]),
    ["Grand Total", grandTotal.toFixed(2)],
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
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
