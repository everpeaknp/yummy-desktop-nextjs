import type { CreditSettlement, CreditSettlementOrder, DayCloseSnapshotData } from "@/types/day-close";

export type DayCloseCreditOrderRow = {
  orderId: number;
  restaurantOrderId?: number;
  customerName: string;
  tableName: string;
  channel: string;
  status: string;
  paymentMethods: string[];
  orderAmount?: number;
  creditAmount?: number;
  createdAt?: string;
  completedAt?: string;
};

export type DayCloseCreditBreakdown = {
  creditOrdersCount: number;
  uniqueCustomersCount: number;
  creditOrdersAmount?: number;
  creditOrders: DayCloseCreditOrderRow[];
};

function isCreditMethod(method: string): boolean {
  const normalized = method.trim().toLowerCase().replace(/_/g, " ");
  return (
    normalized.includes("credit") ||
    normalized === "unpaid" ||
    normalized.includes("pay later")
  );
}

function mapSettlementOrder(order: CreditSettlementOrder): DayCloseCreditOrderRow {
  const rawCustomer = String(order.customer_name ?? "").trim();
  const customerName = rawCustomer || "Walk-in / Unknown";
  const methods = (order.payment_methods ?? [])
    .map((method) => String(method).trim())
    .filter(Boolean);

  return {
    orderId: order.order_id,
    restaurantOrderId: order.restaurant_order_id,
    customerName,
    tableName: order.table_name || "Takeaway/Delivery",
    channel: order.channel || "—",
    status: order.status || "—",
    paymentMethods: methods,
    orderAmount: order.grand_total,
    creditAmount: order.credit_amount ?? order.grand_total,
    createdAt: order.created_at,
    completedAt: order.completed_at,
  };
}

/** Order-level credit breakdown — mirrors mobile `buildDayCloseCreditBreakdown`. */
export function buildDayCloseCreditBreakdown(
  snapshot: DayCloseSnapshotData,
): DayCloseCreditBreakdown {
  const creditSettlement = snapshot.credit_settlement;

  if (creditSettlement?.orders?.length) {
    const rows = creditSettlement.orders.map(mapSettlementOrder);
    const uniqueCustomers = new Set(
      rows
        .map((row) => row.customerName.trim().toLowerCase())
        .filter((name) => name && name !== "walk-in / unknown"),
    ).size;

    return {
      creditOrdersCount:
        creditSettlement.orders_count != null && creditSettlement.orders_count > 0
          ? creditSettlement.orders_count
          : rows.length,
      uniqueCustomersCount:
        creditSettlement.customers_count != null && creditSettlement.customers_count > 0
          ? creditSettlement.customers_count
          : uniqueCustomers,
      creditOrdersAmount: creditSettlement.amount,
      creditOrders: rows,
    };
  }

  return {
    creditOrdersCount: snapshot.receivables?.credit_orders_count ?? 0,
    uniqueCustomersCount: 0,
    creditOrdersAmount: snapshot.receivables?.credit_sales,
    creditOrders: [],
  };
}

export function formatPaymentStatus(methods: string[]): string {
  if (!methods.length) return "Credit";
  const normalized = methods.map((m) => m.replace(/_/g, " "));
  if (normalized.some(isCreditMethod)) return "Credit / Unpaid";
  return normalized.join(", ");
}
