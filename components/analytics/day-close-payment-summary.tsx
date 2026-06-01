"use client";

import { useEffect, useMemo, useState } from "react";
import apiClient from "@/lib/api-client";
import { RestaurantApis } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import {
  buildPaymentSummary,
  paymentSummaryGrandTotal,
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

  const grandTotal = useMemo(() => paymentSummaryGrandTotal(lines), [lines]);
  const maxAmount = useMemo(
    () => Math.max(...lines.map((line) => line.amount), grandTotal, 1),
    [lines, grandTotal],
  );

  return (
    <div className={cn("space-y-4", className)}>
      <div className="px-1">
        <h4 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
          {title}
        </h4>
        {subtitle ? (
          <p className="text-xs text-muted-foreground font-semibold mt-1">{subtitle}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border/60 bg-muted/10 overflow-hidden">
        {lines.map((line) => (
          <PaymentSummaryRow
            key={line.key}
            line={line}
            maxAmount={maxAmount}
            showBar={showBars}
          />
        ))}
        <div className="px-5 py-4 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-4">
          <p className="text-sm font-black text-foreground">Grand Total</p>
          <p className="text-sm font-black text-foreground tabular-nums">{formatRs(grandTotal)}</p>
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
  const grandTotal = paymentSummaryGrandTotal(lines);
  const rows = [
    ["Payment Method", "Amount (NPR)"],
    ...lines.map((line) => [line.label, line.amount.toFixed(2)]),
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
