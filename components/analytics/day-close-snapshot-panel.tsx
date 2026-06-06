"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DayCloseSnapshotData } from "@/types/day-close";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import {
  formatDayCloseCoveredRange,
  formatDayCloseCloseName,
} from "@/lib/day-close-format";
import {
  isHotelDayClose,
  snapshotExpenseRows,
  snapshotHotelSplitRows,
  snapshotInstrumentRows,
  snapshotMetricRows,
  snapshotPaymentMethodRows,
  snapshotPurchaseRows,
  snapshotRefundRows,
} from "@/lib/day-close-snapshot-view";
import { DayCloseMetricCard } from "@/components/analytics/day-close-metric-card";
import { DayClosePaymentMethodsCard } from "@/components/analytics/day-close-payment-methods-card";
import { DayCloseReceivablesSection } from "@/components/analytics/day-close-receivables-section";
import { cn } from "@/lib/utils";

type DayCloseSnapshotPanelProps = {
  snapshot: DayCloseSnapshotData;
  className?: string;
};

export function DayCloseSnapshotPanel({ snapshot, className }: DayCloseSnapshotPanelProps) {
  const metrics = snapshotMetricRows(snapshot);
  const paymentMethods = snapshotPaymentMethodRows(snapshot);
  const cardInstruments = snapshotInstrumentRows(snapshot, "card");
  const digitalInstruments = snapshotInstrumentRows(snapshot, "digital");
  const expenses = snapshotExpenseRows(snapshot);
  const hotelSplit = isHotelDayClose(snapshot) ? snapshotHotelSplitRows(snapshot) : [];
  const credit = snapshot.credit_settlement;
  const refunds = snapshotRefundRows(snapshot);
  const purchases = snapshotPurchaseRows(snapshot);
  const coveredRange = formatDayCloseCoveredRange(
    snapshot.period_start_at,
    snapshot.period_end_at,
  );

  return (
    <div className={cn("space-y-6", className)}>
      {coveredRange ? (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[80px] -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <div className="relative z-10 px-5 py-4 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground opacity-80">
                {formatDayCloseCloseName(snapshot.business_line)}
              </p>
              <p className="text-sm font-semibold text-foreground mt-1 break-words">{coveredRange}</p>
            </div>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/20 border border-border/50 rounded-2xl">
          <TabsTrigger value="payments" className="rounded-xl font-bold text-xs sm:text-sm">
            Payments
          </TabsTrigger>
          <TabsTrigger value="credit" className="rounded-xl font-bold text-xs sm:text-sm">
            Credit
          </TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-xl font-bold text-xs sm:text-sm">
            Expenses
          </TabsTrigger>
          <TabsTrigger value="refunds" className="rounded-xl font-bold text-xs sm:text-sm">
            Refunds
          </TabsTrigger>
          <TabsTrigger value="receivables" className="rounded-xl font-bold text-xs sm:text-sm">
            Receivables
          </TabsTrigger>
          {purchases.length > 0 ? (
            <TabsTrigger value="purchases" className="rounded-xl font-bold text-xs sm:text-sm">
              Purchases
            </TabsTrigger>
          ) : null}
        </TabsList>
        <div className="mt-4 space-y-4">
          <TabsContent value="payments" className="m-0 space-y-4">
            <DayClosePaymentMethodsCard title="Payment Methods" rows={paymentMethods} />
            {cardInstruments.length > 0 ? (
              <DayClosePaymentMethodsCard
                title="Card by Instrument"
                rows={cardInstruments}
                nested
              />
            ) : null}
            {digitalInstruments.length > 0 ? (
              <DayClosePaymentMethodsCard
                title="Digital/QR by Instrument"
                rows={digitalInstruments}
                nested
              />
            ) : null}
            {paymentMethods.length === 0 &&
            cardInstruments.length === 0 &&
            digitalInstruments.length === 0 ? (
              <EmptySnapshotNotice message="Payment breakdown is not available in this snapshot." />
            ) : null}
          </TabsContent>
          <TabsContent value="credit" className="m-0">
            {!credit ? (
              <EmptySnapshotNotice message="Credit settlement is not available in this snapshot." />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <DayCloseMetricCard
                    compact
                    label="Customers"
                    value={credit.customers_count != null ? String(credit.customers_count) : "—"}
                    accent="from-blue-500/50 to-blue-500/10"
                  />
                  <DayCloseMetricCard
                    compact
                    label="Orders"
                    value={credit.orders_count != null ? String(credit.orders_count) : "—"}
                    accent="from-amber-500/50 to-amber-500/10"
                  />
                  <DayCloseMetricCard
                    compact
                    label="Amount"
                    value={formatDayCloseCurrency(credit.amount)}
                    accent="from-rose-500/50 to-rose-500/10"
                  />
                </div>
                {credit.orders && credit.orders.length > 0 ? (
                  <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-5 py-3 border-b border-border/40">
                      Credit Orders
                    </p>
                    <div className="max-h-48 overflow-auto">
                      {credit.orders.map((order) => (
                        <Link
                          key={order.order_id}
                          href={`/orders/${order.order_id}`}
                          className="flex items-center justify-between px-5 py-3 border-b last:border-none hover:bg-muted/30 text-sm transition-colors"
                        >
                          <span className="font-medium truncate">
                            #{order.restaurant_order_id ?? order.order_id}
                            {order.customer_name ? ` • ${order.customer_name}` : ""}
                            {order.table_name ? ` • ${order.table_name}` : ""}
                          </span>
                          <span className="font-bold tabular-nums">
                            {formatDayCloseCurrency(order.credit_amount ?? order.grand_total)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>
          <TabsContent value="expenses" className="m-0">
            {expenses.length > 0 ? (
              <SimpleListCard title="Expenses" rows={expenses} expenseTone scrollable />
            ) : (
              <EmptySnapshotNotice message="Expense breakdown is not available in this snapshot." />
            )}
          </TabsContent>
          <TabsContent value="refunds" className="m-0">
            {refunds.length > 0 ? (
              <SimpleListCard title="Refunds" rows={refunds} expenseTone />
            ) : (
              <EmptySnapshotNotice message="No refunds recorded in this close window." />
            )}
          </TabsContent>
          <TabsContent value="receivables" className="m-0">
            <DayCloseReceivablesSection snapshot={snapshot} />
          </TabsContent>
          {purchases.length > 0 ? (
            <TabsContent value="purchases" className="m-0">
              <SimpleListCard title="Purchases" rows={purchases} />
            </TabsContent>
          ) : null}
        </div>
      </Tabs>

      {metrics.length > 0 ? (
        <section className="space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Financial Summary
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((row) => (
              <DayCloseMetricCard
                key={row.label}
                compact
                label={row.label}
                value={formatDayCloseCurrency(row.value)}
              />
            ))}
          </div>
        </section>
      ) : (
        <EmptySnapshotNotice message="Financial summary is not available in this snapshot." />
      )}

      {hotelSplit.length > 0 ? (
        <section className="space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Hotel Revenue Split
          </h4>
          <SimpleListCard title="Room vs Food" rows={hotelSplit} />
        </section>
      ) : null}
    </div>
  );
}

function SimpleListCard({
  title,
  rows,
  expenseTone,
  scrollable = false,
}: {
  title: string;
  rows: Array<{ label: string; amount?: number; secondary?: string }>;
  expenseTone?: boolean;
  scrollable?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-5 py-3 border-b border-border/40">
        {title}
      </p>
      <div className={cn("p-3 space-y-2", scrollable && "max-h-44 overflow-auto")}>
        {rows.map((row, idx) => (
          <div
            key={`${row.label}-${idx}`}
            className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/10 px-3 py-2.5"
          >
            <div className="min-w-0 pr-2">
              <span className="text-sm font-medium truncate block">{row.label}</span>
              {row.secondary ? (
                <span className="text-[11px] text-muted-foreground">{row.secondary}</span>
              ) : null}
            </div>
            <span
              className={cn(
                "text-sm font-bold whitespace-nowrap tabular-nums",
                expenseTone
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {formatDayCloseCurrency(row.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptySnapshotNotice({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border/60 px-5 py-8 text-center bg-muted/10">
      {message}
    </p>
  );
}
