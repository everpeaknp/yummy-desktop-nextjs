import { describe, expect, it } from "vitest";

import type { PayrollPayment } from "./payables";
import {
  payrollPaymentMethodLabel,
  payrollPaymentSourceLabel,
  previewPayrollAllocations,
  requiresPayrollBank,
  requiresPayrollReference,
} from "./payment-form";

describe("payroll payment form helpers", () => {
  it("allocates a partial payment to the oldest salary first", () => {
    const result = previewPayrollAllocations(
      [
        {
          payroll_item_id: 2,
          payroll_run_id: 20,
          date_from: "2026-06-01",
          date_to: "2026-06-30",
          run_status: "approved",
          net_pay: 20000,
          paid_amount: 0,
          outstanding_amount: 20000,
          due_date: "2026-07-01",
        },
        {
          payroll_item_id: 1,
          payroll_run_id: 10,
          date_from: "2026-05-01",
          date_to: "2026-05-31",
          run_status: "partially_paid",
          net_pay: 15000,
          paid_amount: 5000,
          outstanding_amount: 10000,
          due_date: "2026-06-01",
        },
      ],
      12000,
    );

    expect(result).toEqual([
      expect.objectContaining({ payrollItemId: 1, amount: 10000, balanceAfter: 0 }),
      expect.objectContaining({ payrollItemId: 2, amount: 2000, balanceAfter: 18000 }),
    ]);
  });

  it("requires a configured bank and reference for bank transfers", () => {
    expect(requiresPayrollBank("bank_transfer")).toBe(true);
    expect(requiresPayrollReference("bank_transfer")).toBe(true);
    expect(requiresPayrollBank("cash")).toBe(false);
    expect(requiresPayrollReference("cash")).toBe(false);
    expect(payrollPaymentMethodLabel("bank_transfer")).toBe("Bank transfer");
  });

  it("uses the persisted source snapshot in payment history", () => {
    expect(
      payrollPaymentSourceLabel({
        id: 1,
        restaurant_id: 52,
        staff_id: 9,
        amount: 1000,
        payment_method: "bank_transfer",
        payment_bank_id: 3,
        payment_bank_name: "Payroll Account",
        paid_at: "2026-07-15T10:00:00Z",
        status: "posted",
        allocations: [],
      } satisfies PayrollPayment),
    ).toBe("Payroll Account");
  });
});
