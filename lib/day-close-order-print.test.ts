import { describe, expect, it } from "vitest";

import {
  buildDayOrdersThermalText,
  formatDayCloseOrderPayments,
  formatDayCloseOrderTime,
} from "./day-close-order-print";
import type { DayCloseOrderSnapshotRow } from "./day-close-snapshot-view";

const splitPaymentOrder: DayCloseOrderSnapshotRow = {
  orderId: 91,
  restaurantOrderId: 18,
  tableName: "T4",
  channel: "dine_in",
  status: "completed",
  grandTotal: 900,
  totalPayment: 900,
  paymentMethods: ["cash", "card"],
  paymentBreakdown: [
    { method: "cash", amount: 500 },
    { method: "card", instrument: "Visa", amount: 400 },
  ],
  createdAt: "2026-07-23T12:15:00+00:00",
  completedAt: "2026-07-23T12:45:30+00:00",
};

describe("day orders thermal report", () => {
  it("prints only the compact order fields with split-payment amounts", () => {
    const text = buildDayOrdersThermalText({
      orders: [splitPaymentOrder],
      timezone: "UTC",
    });

    expect(text).toContain("Order ID: #18");
    expect(text).toContain("Table: T4");
    expect(text).toContain("Total Payment: Rs. 900.00");
    expect(text).toContain("Payment: Cash: Rs. 500.00 + Card (Visa): Rs. 400.00");
    expect(text).toContain("Time: 12:45 PM");
    expect(text).not.toContain("dine_in");
    expect(text).not.toContain("completed");
    expect(text).not.toContain("Grand Total");
  });

  it("uses old payment method names when amounts were not saved", () => {
    const oldOrder: DayCloseOrderSnapshotRow = {
      orderId: 12,
      grandTotal: 650,
      totalPayment: 650,
      paymentMethods: ["cash", "digital"],
      paymentBreakdown: [],
    };

    expect(formatDayCloseOrderPayments(oldOrder)).toBe("Cash + Digital");
  });

  it("uses completed time before created time", () => {
    expect(formatDayCloseOrderTime(splitPaymentOrder, "UTC")).toBe("12:45 PM");
  });
});
