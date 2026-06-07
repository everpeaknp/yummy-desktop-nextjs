"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DayCloseDetail, DayCloseSnapshotData } from "@/types/day-close";
import { formatDayCloseCurrency } from "@/lib/day-close-format";
import {
  formatDayCloseCoveredRange,
  formatDayCloseCloseName,
} from "@/lib/day-close-format";
import {
  isHotelDayClose,
  snapshotDayOrderRows,
  snapshotExpenseRows,
  snapshotHotelSplitRows,
  snapshotInstrumentRows,
  snapshotPaymentMethodRows,
  snapshotPurchaseRows,
  snapshotReceivableRows,
  snapshotRefundRows,
  snapshotSalesByCategoryRows,
  snapshotSalesByTableRows,
  type DayCloseSnapshotTab,
} from "@/lib/day-close-snapshot-view";
import { DayCloseMetricCard } from "@/components/analytics/day-close-metric-card";
import { DayCloseFinancialSummary } from "@/components/analytics/day-close-financial-summary";
import { DayClosePaymentMethodsCard } from "@/components/analytics/day-close-payment-methods-card";
import { cn } from "@/lib/utils";

type DayCloseSnapshotPanelProps = {
  snapshot: DayCloseSnapshotData;
  detail?: DayCloseDetail | null;
  className?: string;
  hideFinancialSummary?: boolean;
  /** Tighter summary + snapshot tab grid for dialog minimized view */
  compact?: boolean;
  activeTab?: DayCloseSnapshotTab;
  onTabChange?: (tab: DayCloseSnapshotTab) => void;
};

export function DayCloseSnapshotPanel({
  snapshot,
  detail,
  className,
  hideFinancialSummary = false,
  compact = false,
  activeTab,
  onTabChange,
}: DayCloseSnapshotPanelProps) {
  const paymentMethods = snapshotPaymentMethodRows(snapshot);
  const cardInstruments = snapshotInstrumentRows(snapshot, "card");
  const digitalInstruments = snapshotInstrumentRows(snapshot, "digital");
  const expenses = snapshotExpenseRows(snapshot);
  const hotelSplit = isHotelDayClose(snapshot) ? snapshotHotelSplitRows(snapshot) : [];
  const credit = snapshot.credit_settlement;
  const refunds = snapshotRefundRows(snapshot);
  const receivables = snapshotReceivableRows(snapshot);
  const purchases = snapshotPurchaseRows(snapshot);
  const dayOrders = snapshotDayOrderRows(snapshot);
  const salesByCategory = snapshotSalesByCategoryRows(snapshot);
  const salesByTable = snapshotSalesByTableRows(snapshot);
  const coveredRange = formatDayCloseCoveredRange(
    snapshot.period_start_at,
    snapshot.period_end_at,
  );
  const [internalTab, setInternalTab] = useState<DayCloseSnapshotTab>("payments");
  const resolvedTab = activeTab ?? internalTab;
  const handleTabChange = (value: string) => {
    const next = value as DayCloseSnapshotTab;
    if (activeTab === undefined) setInternalTab(next);
    onTabChange?.(next);
  };

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
              <p className="dc-eyebrow">
                {formatDayCloseCloseName(snapshot.business_line)}
              </p>
              <p className="text-sm font-semibold text-foreground mt-1 break-words">{coveredRange}</p>
            </div>
          </div>
        </div>
      ) : null}

      {!hideFinancialSummary ? (
        <DayCloseFinancialSummary
          snapshot={snapshot}
          detail={detail}
          compact={compact}
          onMetricNavigate={onTabChange}
        />
      ) : null}

      <Tabs
        value={resolvedTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList
          className={cn(
            "dc-tabs-list rounded-2xl",
            compact
              ? "!grid grid-cols-3 gap-1.5 w-full p-1 h-auto"
              : "flex w-full justify-start overflow-x-auto flex-wrap gap-1.5 pl-2 sm:pl-3 h-auto",
          )}
        >
          <TabsTrigger value="payments" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
            Payments
          </TabsTrigger>
          <TabsTrigger value="credit" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
            Credit
          </TabsTrigger>
          <TabsTrigger value="expenses" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
            Expenses
          </TabsTrigger>
          <TabsTrigger value="refunds" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
            Refunds
          </TabsTrigger>
          <TabsTrigger value="receivables" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
            Receivables
          </TabsTrigger>
          {purchases.length > 0 ? (
            <TabsTrigger value="purchases" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
              Purchases
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="day-orders" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
            Day Orders
          </TabsTrigger>
          <TabsTrigger value="sales-by-category" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
            Sales by Category
          </TabsTrigger>
          <TabsTrigger value="sales-by-table" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
            Sales by Table
          </TabsTrigger>
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
                  />
                  <DayCloseMetricCard
                    compact
                    label="Orders"
                    value={credit.orders_count != null ? String(credit.orders_count) : "—"}
                  />
                  <DayCloseMetricCard
                    compact
                    label="Amount"
                    value={formatDayCloseCurrency(credit.amount)}
                    iconPosition="top-right"
                  />
                </div>
                {credit.orders && credit.orders.length > 0 ? (
                  <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
                    <p className="dc-eyebrow px-5 py-3 border-b border-border/40">
                      Credit Orders
                    </p>
                    <div>
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
                          <span className="dc-amount">
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
            {receivables.length > 0 ? (
              <SimpleListCard title="Receivables" rows={receivables} />
            ) : (
              <EmptySnapshotNotice message="No receivable breakdown in this snapshot." />
            )}
          </TabsContent>
          {purchases.length > 0 ? (
            <TabsContent value="purchases" className="m-0">
              <SimpleListCard title="Purchases" rows={purchases} />
            </TabsContent>
          ) : null}
          <TabsContent value="day-orders" className="m-0">
            {dayOrders.length > 0 ? (
              <DayOrdersList orders={dayOrders} />
            ) : (
              <EmptySnapshotNotice message="Day orders are not available in this snapshot." />
            )}
          </TabsContent>
          <TabsContent value="sales-by-category" className="m-0">
            {salesByCategory.length > 0 ? (
              <SimpleListCard title="Sales by Category" rows={salesByCategory} />
            ) : (
              <EmptySnapshotNotice message="Sales by category are not available in this snapshot." />
            )}
          </TabsContent>
          <TabsContent value="sales-by-table" className="m-0">
            {salesByTable.length > 0 ? (
              <SimpleListCard title="Sales by Table" rows={salesByTable} />
            ) : (
              <EmptySnapshotNotice message="Sales by table are not available in this snapshot." />
            )}
          </TabsContent>
        </div>
      </Tabs>

      {hotelSplit.length > 0 ? (
        <section className="space-y-4">
          <h4 className="dc-section-title">
            Hotel Revenue Split
          </h4>
          <SimpleListCard title="Room vs Food" rows={hotelSplit} />
        </section>
      ) : null}
    </div>
  );
}

function DayOrdersList({
  orders,
}: {
  orders: ReturnType<typeof snapshotDayOrderRows>;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
      <p className="dc-eyebrow px-5 py-3 border-b border-border/40">
        Day Orders ({orders.length})
      </p>
      <div>
        {orders.map((order) => {
          const isRefunded =
            order.isRefunded || String(order.status ?? "").toLowerCase() === "refunded";
          const statusLabel = isRefunded
            ? "REFUNDED"
            : String(order.status ?? "completed").toUpperCase();
          const subtitleParts = [
            order.tableName ?? "Takeaway/Delivery",
            order.channel ? order.channel.toUpperCase() : null,
            statusLabel,
            isRefunded && order.refundAmount
              ? `Refund ${formatDayCloseCurrency(order.refundAmount)}`
              : null,
          ].filter(Boolean);

          return (
            <Link
              key={order.orderId}
              href={`/orders/${order.orderId}`}
              className="flex items-center justify-between gap-3 px-5 py-3 border-b last:border-none hover:bg-muted/30 text-sm transition-colors"
            >
              <div className="min-w-0">
                <span className="font-medium block truncate">
                  Order #{order.restaurantOrderId ?? order.orderId}
                </span>
                <span
                  className={cn(
                    "text-xs truncate block",
                    isRefunded
                      ? "text-rose-600 dark:text-rose-400 font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  {subtitleParts.join(" · ")}
                </span>
              </div>
              <span className="dc-amount shrink-0">
                {formatDayCloseCurrency(order.grandTotal)}
              </span>
            </Link>
          );
        })}
      </div>
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
      <p className="dc-eyebrow px-5 py-3 border-b border-border/40">
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
                "text-sm dc-amount whitespace-nowrap",
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
