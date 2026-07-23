import { describe, expect, it } from "vitest";

import {
  snapshotDayOrderRows,
  snapshotOrdersForTable,
  snapshotSalesByTableRows,
} from "./day-close-snapshot-view";

describe("day close order snapshot rows", () => {
  it("reads table, time, total payment, and amount-aware split payments", () => {
    const rows = snapshotDayOrderRows({
      orders: [{
        order_id: 91,
        restaurant_order_id: 18,
        table_id: 4,
        table_name: "T4",
        grand_total: 900,
        total_payment: 900,
        created_at: "2026-07-23T12:15:00+00:00",
        completed_at: "2026-07-23T12:45:30+00:00",
        payment_methods: ["cash", "card"],
        payment_breakdown: [
          { method: "cash", instrument: null, amount: 500 },
          { method: "card", instrument: "Visa", amount: 400 },
        ],
      }],
    });

    expect(rows).toEqual([expect.objectContaining({
      orderId: 91,
      restaurantOrderId: 18,
      tableId: 4,
      tableName: "T4",
      grandTotal: 900,
      totalPayment: 900,
      completedAt: "2026-07-23T12:45:30+00:00",
      paymentMethods: ["cash", "card"],
      paymentBreakdown: [
        { method: "cash", instrument: undefined, amount: 500 },
        { method: "card", instrument: "Visa", amount: 400 },
      ],
    })]);
  });

  it("falls back to old snapshot payment names and grand total", () => {
    const [row] = snapshotDayOrderRows({
      orders: [{
        order_id: 12,
        table_name: "Patio",
        grand_total: "650.00",
        payment_methods: ["cash", "digital"],
      }],
    });

    expect(row.totalPayment).toBe(650);
    expect(row.paymentBreakdown).toEqual([]);
    expect(row.paymentMethods).toEqual(["cash", "digital"]);
  });
});

describe("sales by table snapshot drill-down", () => {
  it("keeps table identity and selects that table's saved orders", () => {
    const snapshot = {
      orders: [
        { order_id: 1, table_id: 7, table_name: "Garden", grand_total: 200 },
        { order_id: 2, table_id: 8, table_name: "Bar", grand_total: 300 },
      ],
      table_details: [{
        table_id: 7,
        table_name: "Garden",
        total_orders: 1,
        revenue: 200,
        orders: [{ order_id: 1 }],
      }],
    };

    const orders = snapshotDayOrderRows(snapshot);
    const [table] = snapshotSalesByTableRows(snapshot);

    expect(table).toEqual(expect.objectContaining({
      tableId: 7,
      tableName: "Garden",
      secondary: "1 order",
      orderIds: [1],
    }));
    expect(snapshotOrdersForTable(orders, table).map((order) => order.orderId)).toEqual([1]);
  });

  it("matches old sales-by-table maps by table name", () => {
    const orders = snapshotDayOrderRows({
      orders: [{ order_id: 4, table_name: "Rooftop", grand_total: 100 }],
    });
    const [table] = snapshotSalesByTableRows({
      sales_by_table: { Rooftop: 100 },
    });

    expect(snapshotOrdersForTable(orders, table).map((order) => order.orderId)).toEqual([4]);
  });
});
