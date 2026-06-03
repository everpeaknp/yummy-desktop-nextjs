/**
 * Read-only snapshot view helpers.
 * Maps backend snapshot_data fields to display rows — never sums or derives totals.
 */

import type {
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
    {
      label: "Avg Items / Order",
      value:
        typeof ops?.avg_items_per_order === "number"
          ? ops.avg_items_per_order
          : undefined,
    },
  ].filter((row) => row.value !== undefined);
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
