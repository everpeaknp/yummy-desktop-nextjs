"use client";

import Link from "next/link";
import { CreditCard, Users } from "lucide-react";
import type { DayCloseSnapshotData } from "@/types/day-close";
import {
  formatDayCloseCurrency,
  pickBackendAmount,
} from "@/lib/day-close-format";
import {
  buildDayCloseCreditBreakdown,
  formatPaymentStatus,
} from "@/lib/day-close-credit-breakdown";
import { snapshotReceivableRows } from "@/lib/day-close-snapshot-view";
import { DayCloseMetricCard } from "@/components/analytics/day-close-metric-card";
import { cn } from "@/lib/utils";

type DayCloseReceivablesSectionProps = {
  snapshot: DayCloseSnapshotData;
  compact?: boolean;
  className?: string;
};

function formatMethodMap(map?: Record<string, unknown>): Array<{ label: string; amount?: number }> {
  if (!map || typeof map !== "object") return [];
  return Object.entries(map).map(([label, value]) => ({
    label: label.replace(/_/g, " "),
    amount: typeof value === "number" ? value : typeof value === "string" ? Number(value) : undefined,
  }));
}

export function DayCloseReceivablesSection({
  snapshot,
  compact = false,
  className,
}: DayCloseReceivablesSectionProps) {
  const receivables = snapshot.receivables;
  const summaryRows = snapshotReceivableRows(snapshot);
  const creditBreakdown = buildDayCloseCreditBreakdown(snapshot);
  const collectionMethods = formatMethodMap(receivables?.credit_collections_by_method);

  const outstanding = pickBackendAmount(receivables?.outstanding_receivables);
  const creditSales = pickBackendAmount(receivables?.credit_sales);
  const creditCollections = pickBackendAmount(receivables?.credit_collections);
  const orderCount = receivables?.credit_orders_count ?? creditBreakdown.creditOrdersCount;

  const hasSummary =
    outstanding != null ||
    creditSales != null ||
    creditCollections != null ||
    orderCount > 0;

  if (!hasSummary && creditBreakdown.creditOrders.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-border/60 bg-muted/10 px-5 py-8 text-center",
          className,
        )}
      >
        <CreditCard className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-foreground">No receivables in this close window</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Credit sales, collections, and outstanding balances will appear here when the backend
          snapshot includes receivables data.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DayCloseMetricCard
          compact
          label="Outstanding Receivables"
          value={formatDayCloseCurrency(outstanding)}
          accent="from-rose-500/50 to-rose-500/10"
          hint="Total customer credit balance (restaurant-wide, from backend)"
        />
        <DayCloseMetricCard
          compact
          label="Credit Sales (window)"
          value={formatDayCloseCurrency(creditSales)}
          accent="from-blue-500/50 to-blue-500/10"
          hint="Credit billed during this close period"
        />
        <DayCloseMetricCard
          compact
          label="Credit Collections"
          value={formatDayCloseCurrency(creditCollections)}
          accent="from-emerald-500/50 to-emerald-500/10"
          hint="Customer credit payments collected in this window"
        />
        <DayCloseMetricCard
          compact
          label="Receivable Orders"
          value={orderCount > 0 ? String(orderCount) : "0"}
          icon={<Users className="h-4 w-4" />}
          accent="from-amber-500/50 to-amber-500/10"
          hint="Credit orders in this close window"
        />
      </div>

      {!compact && summaryRows.length > 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-5 py-3 border-b border-border/40">
            Receivables Summary (backend)
          </p>
          <div className="divide-y divide-border/40">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{row.label}</p>
                  {row.secondary ? (
                    <p className="text-[11px] text-muted-foreground">{row.secondary}</p>
                  ) : null}
                </div>
                <span className="font-bold tabular-nums">{formatDayCloseCurrency(row.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!compact && collectionMethods.length > 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-5 py-3 border-b border-border/40">
            Collections by Payment Method
          </p>
          <div className="divide-y divide-border/40">
            {collectionMethods.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium capitalize">{row.label}</span>
                <span className="font-bold tabular-nums">{formatDayCloseCurrency(row.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Credit Orders (source detail)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Each row is a credit order in this close window — click to open the order.
            </p>
          </div>
          <p className="text-xs font-semibold text-muted-foreground">
            {creditBreakdown.creditOrders.length} orders ·{" "}
            {creditBreakdown.uniqueCustomersCount} customers
          </p>
        </div>

        {creditBreakdown.creditOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground px-5 py-8 text-center">
            No credit orders in this snapshot. Outstanding receivables may still apply from prior
            periods.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20 text-left">
                  <th className="px-4 py-2.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                    Customer
                  </th>
                  <th className="px-4 py-2.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                    Order #
                  </th>
                  <th className="px-4 py-2.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                    Due Amount
                  </th>
                  <th className="px-4 py-2.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-2.5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                    Payment
                  </th>
                </tr>
              </thead>
              <tbody>
                {creditBreakdown.creditOrders.map((order) => (
                  <tr
                    key={order.orderId}
                    className="border-b border-border/30 last:border-none hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-medium">{order.customerName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.orderId}`}
                        className="font-bold text-primary hover:underline tabular-nums"
                      >
                        #{order.restaurantOrderId ?? order.orderId}
                      </Link>
                      {order.tableName ? (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                          {order.tableName}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums whitespace-nowrap">
                      {formatDayCloseCurrency(order.creditAmount)}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">
                      {String(order.status).replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatPaymentStatus(order.paymentMethods)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
