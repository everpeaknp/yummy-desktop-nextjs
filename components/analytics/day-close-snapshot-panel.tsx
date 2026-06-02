"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DayCloseSnapshotData } from "@/types/day-close";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import {
  isHotelDayClose,
  snapshotExpenseRows,
  snapshotHotelSplitRows,
  snapshotInstrumentRows,
  snapshotMetricRows,
  snapshotPaymentMethodRows,
} from "@/lib/day-close-snapshot-view";
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

  return (
    <div className={cn("space-y-6", className)}>
      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <TabsTrigger value="payments" className="rounded-lg">
            Payments
          </TabsTrigger>
          <TabsTrigger value="credit" className="rounded-lg">
            Credit
          </TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-lg">
            Expenses
          </TabsTrigger>
        </TabsList>
        <div className="mt-4 space-y-3">
          <TabsContent value="payments" className="m-0 space-y-3">
            <ListCard title="Payment Methods" rows={paymentMethods} />
            {cardInstruments.length > 0 ? (
              <ListCard title="Card by Instrument" rows={cardInstruments} />
            ) : null}
            {digitalInstruments.length > 0 ? (
              <ListCard title="Digital/QR by Instrument" rows={digitalInstruments} />
            ) : null}
            {paymentMethods.length === 0 && cardInstruments.length === 0 && digitalInstruments.length === 0 ? (
              <EmptySnapshotNotice message="Payment breakdown is not available in this snapshot." />
            ) : null}
          </TabsContent>
          <TabsContent value="credit" className="m-0">
            {!credit ? (
              <EmptySnapshotNotice message="Credit settlement is not available in this snapshot." />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard
                    label="Customers"
                    value={credit.customers_count != null ? String(credit.customers_count) : "—"}
                  />
                  <MetricCard
                    label="Orders"
                    value={credit.orders_count != null ? String(credit.orders_count) : "—"}
                  />
                  <MetricCard label="Amount" value={formatDayCloseCurrency(credit.amount)} />
                </div>
                {credit.orders && credit.orders.length > 0 ? (
                  <div className="rounded-xl border bg-slate-50 dark:bg-slate-900 overflow-hidden">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-4 py-2 border-b">
                      Credit Orders
                    </p>
                    <div className="max-h-48 overflow-auto">
                      {credit.orders.map((order) => (
                        <Link
                          key={order.order_id}
                          href={`/orders/${order.order_id}`}
                          className="flex items-center justify-between px-4 py-2.5 border-b last:border-none hover:bg-muted/40 text-sm"
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
              <ListCard title="Expenses" rows={expenses} expenseTone scrollable />
            ) : (
              <EmptySnapshotNotice message="Expense breakdown is not available in this snapshot." />
            )}
          </TabsContent>
        </div>
      </Tabs>

      {metrics.length > 0 ? (
        <section className="space-y-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Financial Summary
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map((row) => (
              <MetricCard key={row.label} label={row.label} value={formatDayCloseCurrency(row.value)} />
            ))}
          </div>
        </section>
      ) : (
        <EmptySnapshotNotice message="Financial summary is not available in this snapshot." />
      )}

      {hotelSplit.length > 0 ? (
        <section className="space-y-3">
          <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Hotel Revenue Split
          </h4>
          <ListCard title="Room vs Food" rows={hotelSplit} />
        </section>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-900">
      <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">
        {label}
      </p>
      <p className="font-bold text-lg leading-tight">{value}</p>
    </div>
  );
}

function ListCard({
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
    <div className="rounded-xl border bg-slate-50 dark:bg-slate-900 p-3">
      <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">
        {title}
      </p>
      <div className={cn("space-y-1.5", scrollable && "max-h-44 overflow-auto")}>
        {rows.map((row, idx) => (
          <div
            key={`${row.label}-${idx}`}
            className="flex items-center justify-between rounded-lg border border-black/5 dark:border-white/10 bg-background px-2 py-1.5"
          >
            <div className="min-w-0 pr-2">
              <span className="text-xs font-medium truncate block">{row.label}</span>
              {row.secondary ? (
                <span className="text-[10px] text-muted-foreground">{row.secondary}</span>
              ) : null}
            </div>
            <span
              className={cn(
                "text-xs font-bold whitespace-nowrap tabular-nums",
                expenseTone
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
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
    <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center">
      {message}
    </p>
  );
}
