/**
 * Read-only snapshot view helpers.
 * Maps backend snapshot_data fields to display rows — never sums or derives totals.
 */

import { pickBackendAmount } from "@/lib/day-close-format";
import type {
  DayCloseDetail,
  DayCloseSnapshotData,
  PaymentInstrumentRow,
} from "@/types/day-close";
import { parsePaymentDistributionBucket } from "@/types/day-close";

export type SnapshotMetricRow = {
  label: string;
  value: number | undefined;
};

export type SnapshotListRow = {
  label: string;
  amount: number | undefined;
  secondary?: string;
};

/** Snapshot panel tabs opened from financial summary cards. */
export type DayCloseSnapshotTab =
  | "payments"
  | "credit"
  | "expenses"
  | "refunds"
  | "receivables"
  | "purchases"
  | "day-orders"
  | "sales-by-category"
  | "sales-by-table";

const FINANCIAL_SUMMARY_SNAPSHOT_TAB: Record<string, DayCloseSnapshotTab> = {
  "Gross Sales": "sales-by-category",
  "Net Sales": "day-orders",
  "Total Income": "payments",
  Refunds: "refunds",
  Expenses: "expenses",
  "Credit Sales": "credit",
  "Credit Collection": "credit",
  "Outstanding Receivables": "receivables",
  "Expected Drawer": "payments",
  "Drawer (Actual)": "payments",
};

export function financialSummarySnapshotTab(label: string): DayCloseSnapshotTab | null {
  return FINANCIAL_SUMMARY_SNAPSHOT_TAB[label] ?? null;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  digital: "Digital/QR",
  fonepay: "Fonepay",
  credit: "Credit",
};

export function snapshotMetricRows(snapshot: DayCloseSnapshotData): SnapshotMetricRow[] {
  const ops = snapshot.operational_snapshot as Record<string, unknown> | undefined;
  return [
    { label: "Gross Sales", value: snapshot.gross_sales },
    { label: "Net Sales", value: snapshot.net_sales },
    { label: "Total Income", value: snapshot.total_income },
    { label: "Expected Cash", value: snapshot.expected_cash },
    { label: "Cash Collected", value: snapshot.cash_collected },
    { label: "Manual Income", value: snapshot.manual_income_total },
    {
      label: "Total Orders",
      value:
        typeof ops?.total_orders === "number"
          ? ops.total_orders
          : undefined,
    },
    {
      label: "Avg Order Value",
      value:
        typeof ops?.avg_order_value === "number"
          ? ops.avg_order_value
          : undefined,
    },
  ].filter((row) => row.value !== undefined);
}

function summaryAmount(...values: Array<number | null | undefined>): number {
  return pickBackendAmount(...values) ?? 0;
}

/** Cards shown in Restaurant Close popup, detail dialog, and snapshot panel. */
export function snapshotFinancialSummaryRows(
  snapshot: DayCloseSnapshotData,
  detail?: DayCloseDetail | null,
): SnapshotMetricRow[] {
  const netSales = summaryAmount(snapshot.net_sales, detail?.net_sales);
  const totalIncome = summaryAmount(snapshot.total_income, detail?.total_income);

  const isConfirmed =
    String(detail?.status ?? "").toLowerCase() === "confirmed" &&
    detail?.actual_cash != null;

  return [
    { label: "Gross Sales", value: summaryAmount(snapshot.gross_sales, detail?.gross_sales) },
    { label: "Net Sales", value: netSales },
    { label: "Total Income", value: totalIncome },
    { label: "Refunds", value: summaryAmount(snapshot.refunds?.total, detail?.refund_total) },
    { label: "Expenses", value: summaryAmount(snapshot.expense_total, detail?.expense_total) },
    {
      label: "Credit Sales",
      value: summaryAmount(snapshot.receivables?.credit_sales, detail?.credit_sales),
    },
    {
      label: "Credit Collection",
      value: summaryAmount(snapshot.receivables?.credit_collections, detail?.credit_collections),
    },
    {
      label: "Outstanding Receivables",
      value: summaryAmount(
        snapshot.receivables?.outstanding_receivables,
        detail?.outstanding_receivables,
      ),
    },
    {
      label: isConfirmed ? "Drawer (Actual)" : "Expected Drawer",
      value: summaryAmount(
        isConfirmed ? detail?.actual_cash : undefined,
        detail?.expected_cash,
        snapshot.expected_cash,
      ),
    },
  ];
}

export function snapshotPaymentMethodRows(snapshot: DayCloseSnapshotData): SnapshotListRow[] {
  const dist = snapshot.payment_distribution;
  if (!dist) return [];

  const rows: SnapshotListRow[] = [];
  for (const method of ["cash", "card", "digital", "fonepay", "credit"] as const) {
    const bucket = parsePaymentDistributionBucket(dist[method]);
    if (!bucket) continue;
    rows.push({
      label: PAYMENT_METHOD_LABELS[method] ?? method,
      amount: bucket.amount,
      secondary: bucket.count != null ? `${bucket.count} payments` : undefined,
    });
  }
  return rows;
}

export function snapshotInstrumentRows(
  snapshot: DayCloseSnapshotData,
  method: "card" | "digital"
): SnapshotListRow[] {
  const fromList = (snapshot.payment_instrument_distribution ?? []).filter(
    (row) => String(row.method).toLowerCase() === method
  );
  if (fromList.length > 0) {
    return fromList.map((row: PaymentInstrumentRow) => ({
      label: row.instrument || method,
      amount: row.amount,
      secondary: row.count != null ? `${row.count} payments` : undefined,
    }));
  }

  const mapKey = method === "card" ? "card_sales_by_instrument" : "digital_sales_by_instrument";
  const map = snapshot[mapKey];
  if (!map || typeof map !== "object") return [];

  return Object.entries(map as Record<string, unknown>).map(([instrument, amount]) => ({
    label: instrument,
    amount: typeof amount === "number" ? amount : typeof amount === "string" ? Number(amount) : undefined,
  }));
}

export function snapshotExpenseRows(snapshot: DayCloseSnapshotData): SnapshotListRow[] {
  if (Array.isArray(snapshot.expenses) && snapshot.expenses.length > 0) {
    const rows: SnapshotListRow[] = [];
    snapshot.expenses.forEach((entry, idx) => {
      if (!entry || typeof entry !== "object") return;
      const row = entry as Record<string, unknown>;
      const amount =
        typeof row.amount === "number"
          ? row.amount
          : typeof row.total === "number"
            ? row.total
            : undefined;
      const label = String(
        (row.category as Record<string, unknown> | undefined)?.name ??
          row.category_name ??
          row.description ??
          row.name ??
          `Expense ${idx + 1}`,
      );
      rows.push({ label, amount });
    });
    return rows;
  }

  const breakdown = snapshot.expense_breakdown;
  if (!breakdown || typeof breakdown !== "object") return [];

  return Object.entries(breakdown).map(([name, value]) => ({
    label: name,
    amount: typeof value === "number" ? value : undefined,
  }));
}

export function snapshotHotelSplitRows(snapshot: DayCloseSnapshotData): SnapshotListRow[] {
  const split = snapshot.hotel_revenue_split;
  if (!split) return [];
  const rows: SnapshotListRow[] = [];
  if (split.room_revenue != null) {
    rows.push({ label: "Room Revenue", amount: split.room_revenue });
  }
  if (split.food_revenue != null) {
    rows.push({ label: "Food Revenue", amount: split.food_revenue });
  }
  return rows;
}

export function isHotelDayClose(snapshot: DayCloseSnapshotData): boolean {
  return String(snapshot.business_line ?? "").toLowerCase() === "hotel";
}

export function snapshotRefundRows(snapshot: DayCloseSnapshotData): SnapshotListRow[] {
  const refunds = snapshot.refunds;
  if (!refunds) return [];
  const rows: SnapshotListRow[] = [];
  if (refunds.total != null) {
    rows.push({
      label: "Total Refunds",
      amount: refunds.total,
      secondary: refunds.count != null ? `${refunds.count} refunds` : undefined,
    });
  }
  const parts: Array<[string, number | undefined]> = [
    ["Cash", refunds.cash_refunds],
    ["Card", refunds.card_refunds],
    ["Digital/QR", refunds.digital_refunds],
    ["Fonepay", refunds.fonepay_refunds],
  ];
  for (const [label, amount] of parts) {
    if (amount != null) rows.push({ label, amount });
  }
  return rows;
}

export function snapshotReceivableRows(snapshot: DayCloseSnapshotData): SnapshotListRow[] {
  const rec = snapshot.receivables;
  if (!rec) return [];
  const rows: SnapshotListRow[] = [];
  if (rec.credit_sales != null) {
    rows.push({
      label: "Credit Sales",
      amount: rec.credit_sales,
      secondary:
        rec.credit_orders_count != null
          ? `${rec.credit_orders_count} orders`
          : undefined,
    });
  }
  if (rec.credit_collections != null) {
    rows.push({ label: "Credit Collections", amount: rec.credit_collections });
  }
  if (rec.cash_credit_collections != null) {
    rows.push({ label: "Cash Credit Collections", amount: rec.cash_credit_collections });
  }
  if (rec.outstanding_receivables != null) {
    rows.push({ label: "Outstanding Receivables", amount: rec.outstanding_receivables });
  }
  return rows;
}

export function snapshotPurchaseRows(snapshot: DayCloseSnapshotData): SnapshotListRow[] {
  const rows: SnapshotListRow[] = [];
  if (snapshot.paid_purchase_total != null) {
    rows.push({
      label: "Paid Purchases (in close)",
      amount: snapshot.paid_purchase_total,
      secondary:
        snapshot.paid_purchase_count != null
          ? `${snapshot.paid_purchase_count} purchases`
          : undefined,
    });
  }
  if (snapshot.pending_purchase_total != null) {
    rows.push({
      label: "Pending Purchases (informational)",
      amount: snapshot.pending_purchase_total,
      secondary:
        snapshot.pending_purchase_count != null
          ? `${snapshot.pending_purchase_count} pending`
          : "Does not affect close totals",
    });
  }
  return rows;
}

function readSnapshotNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function mapLabelAmountRows(value: unknown): SnapshotListRow[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([label, amount]) => ({
      label,
      amount: readSnapshotNumber(amount),
    }))
    .filter((row) => row.amount != null)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
}

export type DayCloseOrderSnapshotRow = {
  orderId: number;
  restaurantOrderId?: string | number;
  tableName?: string;
  channel?: string;
  status?: string;
  grandTotal?: number;
  isRefunded?: boolean;
  refundAmount?: number;
};

export function snapshotDayOrderRows(snapshot: DayCloseSnapshotData): DayCloseOrderSnapshotRow[] {
  if (!Array.isArray(snapshot.orders)) return [];

  const rows: DayCloseOrderSnapshotRow[] = [];
  for (const entry of snapshot.orders) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const orderId = Number(row.order_id);
    if (!Number.isFinite(orderId)) continue;

    rows.push({
      orderId,
      restaurantOrderId:
        row.restaurant_order_id != null ? (row.restaurant_order_id as string | number) : undefined,
      tableName: row.table_name != null ? String(row.table_name) : undefined,
      channel: row.channel != null ? String(row.channel) : undefined,
      status: row.status != null ? String(row.status) : undefined,
      grandTotal: readSnapshotNumber(row.grand_total),
      isRefunded: Boolean(row.is_refunded),
      refundAmount: readSnapshotNumber(row.refund_amount),
    });
  }
  return rows;
}

export function snapshotSalesByCategoryRows(snapshot: DayCloseSnapshotData): SnapshotListRow[] {
  const details = Array.isArray(snapshot.category_details) ? snapshot.category_details : [];
  if (details.length > 0) {
    const rows: SnapshotListRow[] = [];
    details.forEach((entry, idx) => {
      if (!entry || typeof entry !== "object") return;
      const row = entry as Record<string, unknown>;
      const label = String(row.category ?? row.name ?? `Category ${idx + 1}`);
      const amount = readSnapshotNumber(row.revenue ?? row.amount ?? row.total);
      if (amount == null) return;
      const quantity = readSnapshotNumber(row.quantity ?? row.qty);
      const ordersCount = readSnapshotNumber(row.orders_count ?? row.order_count);
      const secondary =
        quantity != null
          ? `${quantity} items`
          : ordersCount != null
            ? `${ordersCount} orders`
            : undefined;
      rows.push({ label, amount, secondary });
    });
    return rows.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  }

  return mapLabelAmountRows(snapshot.sales_by_category);
}

export function snapshotSalesByTableRows(snapshot: DayCloseSnapshotData): SnapshotListRow[] {
  const details = Array.isArray(snapshot.table_details) ? snapshot.table_details : [];
  if (details.length > 0) {
    const rows: SnapshotListRow[] = [];
    details.forEach((entry, idx) => {
      if (!entry || typeof entry !== "object") return;
      const row = entry as Record<string, unknown>;
      const label = String(row.table_name ?? row.name ?? `Table ${idx + 1}`);
      const amount = readSnapshotNumber(row.revenue ?? row.sales ?? row.amount ?? row.total);
      if (amount == null) return;
      const ordersCount = readSnapshotNumber(row.orders_count ?? row.order_count);
      rows.push({
        label,
        amount,
        secondary: ordersCount != null ? `${ordersCount} orders` : undefined,
      });
    });
    return rows.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  }

  return mapLabelAmountRows(snapshot.sales_by_table);
}
