"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar, ChevronRight, Loader2, Printer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DayCloseDetail,
  DayCloseDrawerControlRow,
  DayCloseSnapshotData,
} from "@/types/day-close";
import {
  formatDayCloseCoveredRange,
  formatDayCloseCloseName,
  formatDayCloseCurrency,
  pickBackendAmount,
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
  snapshotOrdersForTable,
  snapshotBankRows,
  snapshotFonepayRows,
  type DayCloseOrderSnapshotRow,
  type DayCloseSnapshotTab,
  type DayCloseTableSalesRow,
  type SnapshotListRow,
} from "@/lib/day-close-snapshot-view";
import {
  formatDayCloseOrderPayments,
  formatDayCloseOrderTime,
  printDayOrdersThermally,
} from "@/lib/day-close-order-print";
import { DayCloseMetricCard } from "@/components/analytics/day-close-metric-card";
import { DayCloseFinancialSummary } from "@/components/analytics/day-close-financial-summary";
import { DayClosePaymentMethodsCard } from "@/components/analytics/day-close-payment-methods-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

function paymentInstrumentSummaryRows(
  methodLabel: string,
  methodRows: SnapshotListRow[],
  instrumentRows: SnapshotListRow[],
): SnapshotListRow[] {
  if (instrumentRows.length === 0) {
    return methodRows.filter((row) => row.label === methodLabel);
  }

  return instrumentRows.map((row) => ({
    ...row,
    label:
      row.label.trim().toLocaleLowerCase() === methodLabel.toLocaleLowerCase()
        ? methodLabel
        : `${row.label} (${methodLabel})`,
  }));
}

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
  const fonepayInstruments = snapshotFonepayRows(snapshot);
  const bankInstruments = snapshotBankRows(snapshot);
  const expenses = snapshotExpenseRows(snapshot);
  const hotelSplit = isHotelDayClose(snapshot) ? snapshotHotelSplitRows(snapshot) : [];
  const credit = snapshot.credit_settlement;
  const refunds = snapshotRefundRows(snapshot);
  const receivables = snapshotReceivableRows(snapshot);
  const purchases = snapshotPurchaseRows(snapshot);
  const dayOrders = snapshotDayOrderRows(snapshot);
  const salesByCategory = snapshotSalesByCategoryRows(snapshot);
  const salesByTable = snapshotSalesByTableRows(snapshot);
  const accountingBridge =
    snapshot.accounting_bridge && typeof snapshot.accounting_bridge === "object"
      ? (snapshot.accounting_bridge as Record<string, unknown>)
      : null;
  const drawerEvidence = snapshotDrawerEvidence(snapshot);
  const expectedDrawerRows = snapshotExpectedDrawerRows(snapshot);
  const [selectedTable, setSelectedTable] = useState<DayCloseTableSalesRow | null>(null);
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
  const selectedTableOrders = selectedTable
    ? snapshotOrdersForTable(dayOrders, selectedTable)
    : [];
  const reportTimezone =
    detail?.timezone
    ?? (typeof snapshot.timezone === "string" ? snapshot.timezone : undefined);
  const salesSummary = [
    {
      label: "Gross Sales",
      amount: pickBackendAmount(snapshot.gross_sales, detail?.gross_sales),
    },
    {
      label: "Discounts",
      amount: pickBackendAmount(snapshot.discount_total, detail?.discount_total),
    },
    {
      label: "Tax",
      amount: pickBackendAmount(snapshot.tax_total, detail?.tax_total),
    },
    {
      label: "Service Charge",
      amount: pickBackendAmount(
        snapshot.service_charge_total,
        detail?.service_charge_total,
      ),
    },
    {
      label: "Refunds",
      amount: pickBackendAmount(snapshot.refunds?.total, detail?.refund_total),
    },
    {
      label: "Net Sales",
      amount: pickBackendAmount(snapshot.net_sales, detail?.net_sales),
    },
    {
      label: "Manual Income",
      amount: pickBackendAmount(snapshot.manual_income_total),
    },
    {
      label: "Expenses",
      amount: pickBackendAmount(snapshot.expense_total, detail?.expense_total),
    },
    {
      label: "Total Income",
      amount: pickBackendAmount(snapshot.total_income, detail?.total_income),
    },
  ];
  const paymentSummary = [
    ...paymentMethods.filter((row) => row.label === "Cash"),
    ...paymentInstrumentSummaryRows("Card", paymentMethods, cardInstruments),
    ...paymentInstrumentSummaryRows("Digital/QR", paymentMethods, digitalInstruments),
    ...paymentInstrumentSummaryRows("Fonepay", paymentMethods, fonepayInstruments),
    ...paymentMethods.filter((row) => row.label === "Credit"),
  ];
  const handlePrintOrders = async (
    orders: DayCloseOrderSnapshotRow[],
    includeDaySummary = true,
  ) => {
    try {
      const result = await printDayOrdersThermally({
        orders,
        restaurantId: detail?.restaurant_id,
        timezone: reportTimezone,
        salesSummary: includeDaySummary ? salesSummary : undefined,
        paymentSummary: includeDaySummary ? paymentSummary : undefined,
      });
      toast.success(
        result.mode === "network"
          ? `Day Orders sent to ${result.printerName || "the default thermal printer"}.`
          : "Thermal print dialog opened.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to print Day Orders.",
      );
    }
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

      {expectedDrawerRows.length > 0 ? (
        <ExpectedDrawerBreakdownCard rows={expectedDrawerRows} />
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
          {drawerEvidence.length > 0 ? (
            <TabsTrigger value="drawer-and-safe" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
              Drawer & Safe
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="accounting-checks" className={cn("dc-tab-trigger", compact && "dc-tab-trigger-compact")}>
            Accounting Checks
          </TabsTrigger>
        </TabsList>
        <div className="mt-4 space-y-4">
          <TabsContent value="payments" className="m-0 space-y-4">
            <DayClosePaymentMethodsCard title="Payment Methods" rows={paymentMethods} />
            {bankInstruments.length > 0 ? (
              <DayClosePaymentMethodsCard
                title="Banks Breakdown"
                rows={bankInstruments}
                nested
              />
            ) : null}
            {fonepayInstruments.length > 0 ? (
              <DayClosePaymentMethodsCard
                title="Fonepay"
                rows={fonepayInstruments}
                nested
              />
            ) : null}
            {cardInstruments.length > 0 ? (
              <DayClosePaymentMethodsCard
                title="Card Sales by Instrument"
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
            digitalInstruments.length === 0 &&
            bankInstruments.length === 0 &&
            fonepayInstruments.length === 0 ? (
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
              <DayOrdersList
                orders={dayOrders}
                timezone={reportTimezone}
                onPrint={() => handlePrintOrders(dayOrders)}
              />
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
              <SalesByTableList
                rows={salesByTable}
                onSelect={setSelectedTable}
              />
            ) : (
              <EmptySnapshotNotice message="Sales by table are not available in this snapshot." />
            )}
          </TabsContent>
          {drawerEvidence.length > 0 ? (
            <TabsContent value="drawer-and-safe" className="m-0">
              <DrawerEvidenceCard rows={drawerEvidence} />
            </TabsContent>
          ) : null}
          <TabsContent value="accounting-checks" className="m-0">
            {accountingBridge ? (
              <AccountingChecksCard bridge={accountingBridge} />
            ) : (
              <EmptySnapshotNotice message="Accounting bridge checks are not available in this snapshot. Reconfirm or review this close from Accounting > Day Closes." />
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

      <Dialog
        open={selectedTable != null}
        onOpenChange={(open) => {
          if (!open) setSelectedTable(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTable?.tableName ?? "Table"} Orders</DialogTitle>
            <DialogDescription>
              {detail?.business_date
                ? `Orders included in the ${detail.business_date} day close.`
                : "Orders included in this saved day close."}
            </DialogDescription>
          </DialogHeader>
          {selectedTableOrders.length > 0 ? (
            <DayOrdersList
              title={`${selectedTable?.tableName ?? "Table"} Orders`}
              orders={selectedTableOrders}
              timezone={reportTimezone}
              onPrint={() => handlePrintOrders(selectedTableOrders, false)}
            />
          ) : (
            <EmptySnapshotNotice message="Order details are not available for this table in this older snapshot." />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountingChecksCard({ bridge }: { bridge: Record<string, unknown> }) {
  const status = String(bridge.status ?? "needs_review");
  const blockers = Array.isArray(bridge.blockers) ? bridge.blockers.map(String) : [];
  const rows = [
    { label: "Unposted Finance Events", value: String(Number(bridge.unposted_finance_events ?? 0)) },
    { label: "Journal Count", value: String(Number(bridge.journal_count ?? 0)) },
    { label: "Trial Balance Difference", value: formatDayCloseCurrency(Number(bridge.trial_balance_difference ?? 0)) },
    { label: "Suspense Amount", value: formatDayCloseCurrency(Number(bridge.suspense_amount ?? 0)) },
    { label: "Cash Variance", value: formatDayCloseCurrency(Number(bridge.cash_variance ?? 0)) },
  ];

  return (
    <div className="space-y-3 rounded-2xl border border-border/50 bg-card/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="dc-eyebrow">Accounting Status</p>
          <p className={cn("mt-1 text-sm font-semibold capitalize", status === "blocked" ? "text-rose-600" : "text-emerald-600")}>
            {status.replace(/_/g, " ")}
          </p>
        </div>
        <Link href="/finance/accounting/day-closes" className="text-sm font-semibold text-primary hover:underline">
          Open accounting review
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{row.value}</p>
          </div>
        ))}
      </div>
      {blockers.length ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
          <p className="mb-2 font-semibold">Blockers</p>
          <ul className="space-y-1">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function snapshotDrawerEvidence(snapshot: DayCloseSnapshotData): Array<Record<string, unknown>> {
  const direct = snapshot.drawer_sessions;
  if (Array.isArray(direct)) return direct.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>>;

  const ops = snapshot.operational_snapshot;
  if (ops && typeof ops === "object" && !Array.isArray(ops)) {
    const rows = (ops as Record<string, unknown>).drawer_sessions;
    if (Array.isArray(rows)) return rows.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>>;
  }

  const evidence = snapshot.drawer_evidence;
  if (Array.isArray(evidence)) return evidence.filter((row) => row && typeof row === "object") as Array<Record<string, unknown>>;
  return [];
}

function snapshotExpectedDrawerRows(snapshot: DayCloseSnapshotData): DayCloseDrawerControlRow[] {
  const rows = Array.isArray(snapshot.drawer_control?.drawers)
    ? snapshot.drawer_control?.drawers ?? []
    : [];
  const currentRows = rows.filter((row) => row?.is_current_session !== false);
  return (currentRows.length > 0 ? currentRows : rows)
    .filter((row): row is DayCloseDrawerControlRow => Boolean(row))
    .filter((row) => row.expected_closing_cash != null);
}

function ExpectedDrawerBreakdownCard({ rows }: { rows: DayCloseDrawerControlRow[] }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-3">
        <div>
          <p className="dc-eyebrow">Expected Cash by Drawer</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This is the drawer-wise split behind the combined Expected Drawer total.
          </p>
        </div>
        <div className="rounded-full border border-border/50 bg-muted/20 px-3 py-1 text-xs font-semibold text-muted-foreground">
          {rows.length} {rows.length === 1 ? "drawer" : "drawers"}
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row, index) => {
          const label = row.name?.trim()
            || [row.station, row.drawer_key].filter(Boolean).join(" / ")
            || `Drawer ${index + 1}`;
          const status = String(row.status || "active").replace(/_/g, " ");
          return (
            <div
              key={`${row.session_id ?? row.configuration_id ?? label}-${index}`}
              className="rounded-xl border border-border/50 bg-muted/10 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{label}</p>
                  <p className="mt-1 truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                    {status}
                  </p>
                </div>
                <div className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatDayCloseCurrency(row.expected_closing_cash)}
                </div>
              </div>
              {row.counted_opening_cash != null ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Opening: {formatDayCloseCurrency(row.counted_opening_cash)}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function readEvidenceAmount(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function DrawerEvidenceCard({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
      <p className="dc-eyebrow px-5 py-3 border-b border-border/40">Drawer Evidence</p>
      <div className="divide-y divide-border/50">
        {rows.map((row, index) => {
          const station = String(row.station ?? "general");
          const drawerKey = String(row.drawer_key ?? row.drawerKey ?? "drawer");
          const status = String(row.status ?? "unknown").replace(/_/g, " ");
          const opening = readEvidenceAmount(row, "counted_opening_cash");
          const expected = readEvidenceAmount(row, "expected_closing_cash");
          const closing = readEvidenceAmount(row, "counted_closing_cash");
          const variance = readEvidenceAmount(row, "cash_variance");
          const retained = readEvidenceAmount(row, "retained_float");

          const settlementAmount = readEvidenceAmount(row, "settlement_amount");
          const settlementMode = String(row.settlement_mode ?? "").replace(/_/g, " ");
          const settlementDest = String(row.settlement_destination ?? "");

          return (
            <div key={station + "-" + drawerKey + "-" + index} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_2.5fr]">
              <div>
                <div className="text-sm font-semibold">{station} / {drawerKey}</div>
                <div className="text-xs capitalize text-muted-foreground">{status}</div>
              </div>
              <div className="grid gap-2 sm:grid-cols-5">
                <EvidenceMetric label="opening count" value={opening} />
                <EvidenceMetric label="expected cash" value={expected} />
                <EvidenceMetric label="closing count" value={closing} />
                <EvidenceMetric label="variance" value={variance} />
                <EvidenceMetric label="retained float" value={retained} />
              </div>
              {settlementAmount != null && settlementAmount > 0 ? (
                <div className="col-span-1 md:col-span-2 mt-2 p-3 bg-muted/20 border border-border/40 rounded-xl flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground uppercase tracking-wide">Safe Settlement</span>
                    {settlementMode ? ` · ${settlementMode}` : ""}
                    {settlementDest ? ` to ${settlementDest}` : ""}
                  </div>
                  <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatDayCloseCurrency(settlementAmount)}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvidenceMetric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {value == null ? "-" : formatDayCloseCurrency(value)}
      </p>
    </div>
  );
}

function DayOrdersList({
  orders,
  title = "Day Orders",
  timezone,
  onPrint,
}: {
  orders: DayCloseOrderSnapshotRow[];
  title?: string;
  timezone?: string;
  onPrint?: () => Promise<void>;
}) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (!onPrint || isPrinting) return;
    setIsPrinting(true);
    try {
      await onPrint();
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 px-5 py-3">
        <p className="dc-eyebrow">
          {title} ({orders.length})
        </p>
        {onPrint ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-2"
            disabled={isPrinting}
            onClick={() => void handlePrint()}
          >
            {isPrinting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="h-3.5 w-3.5" />
            )}
            Thermal Print
          </Button>
        ) : null}
      </div>
      <div>
        {orders.map((order) => {
          const isRefunded =
            order.isRefunded || String(order.status ?? "").toLowerCase() === "refunded";
          const tableName = order.tableName ?? "Takeaway/Delivery";
          const orderTime = formatDayCloseOrderTime(order, timezone);
          const paymentBreakdown = formatDayCloseOrderPayments(order);

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
                    "mt-0.5 text-xs block",
                    isRefunded
                      ? "text-rose-600 dark:text-rose-400 font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  Table: {tableName} · Time: {orderTime}
                  {isRefunded ? " · Refunded" : ""}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Payment: {paymentBreakdown}
                </span>
              </div>
              <span className="dc-amount shrink-0">
                {formatDayCloseCurrency(order.totalPayment ?? order.grandTotal)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SalesByTableList({
  rows,
  onSelect,
}: {
  rows: DayCloseTableSalesRow[];
  onSelect: (row: DayCloseTableSalesRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
      <p className="dc-eyebrow border-b border-border/40 px-5 py-3">
        Sales by Table
      </p>
      <div className="space-y-2 p-3">
        {rows.map((row, index) => (
          <button
            key={`${row.tableId ?? row.tableName}-${index}`}
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
            onClick={() => onSelect(row)}
          >
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium">{row.label}</span>
              {row.secondary ? (
                <span className="text-[11px] text-muted-foreground">{row.secondary}</span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="dc-amount whitespace-nowrap text-sm text-emerald-600 dark:text-emerald-400">
                {formatDayCloseCurrency(row.amount)}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}
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
