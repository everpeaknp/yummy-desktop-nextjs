import { describe, expect, it } from "vitest";

import type { PayrollPayment } from "./payables";
import {
  canUsePayrollSafe,
  isPayrollSafeAccountingReady,
  payrollPaymentMethodLabel,
  payrollPaymentSourceLabel,
  payrollRunPaymentErrorMessage,
  payrollSafeFundingError,
  previewPayrollAllocations,
  previewPayrollTaxAllocations,
  requiresPayrollBank,
  requiresPayrollReference,
} from "./payment-form";
import type { DrawerCashControlSummary } from "@/types/accounting";

function readySafeSummary(
  overrides: Partial<DrawerCashControlSummary> = {},
): DrawerCashControlSummary {
  return {
    restaurant_id: 52,
    business_line: "restaurant",
    finance_accounting_enabled: true,
    accounting_v2_enabled: true,
    ledger_complete: true,
    active_session_count: 1,
    active_drawer_cash: 1000,
    retained_drawer_cash: 0,
    drawer_cash: 1000,
    safe_cash: 5000,
    cash_in_transit: 0,
    total_controlled_cash: 6000,
    source_accounts: { safe_cash: "Account 1005 Main Cash / Safe" },
    ...overrides,
  };
}

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

  it("matches backend run ordering when salary periods end together", () => {
    const result = previewPayrollAllocations(
      [
        {
          payroll_item_id: 1,
          payroll_run_id: 20,
          date_from: "2026-06-15",
          date_to: "2026-06-30",
          run_status: "approved",
          net_pay: 5000,
          paid_amount: 0,
          outstanding_amount: 5000,
          due_date: "2026-07-01",
        },
        {
          payroll_item_id: 2,
          payroll_run_id: 10,
          date_from: "2026-06-01",
          date_to: "2026-06-30",
          run_status: "approved",
          net_pay: 5000,
          paid_amount: 0,
          outstanding_amount: 5000,
          due_date: "2026-07-01",
        },
      ],
      1000,
    );

    expect(result).toEqual([
      expect.objectContaining({ payrollRunId: 10, amount: 1000 }),
    ]);
  });

  it("requires a configured bank and reference for bank transfers", () => {
    expect(requiresPayrollBank("bank_transfer")).toBe(true);
    expect(requiresPayrollReference("bank_transfer")).toBe(true);
    expect(requiresPayrollBank("cash")).toBe(false);
    expect(requiresPayrollReference("cash")).toBe(false);
    expect(requiresPayrollReference("cash", "safe")).toBe(true);
    expect(payrollPaymentMethodLabel("bank_transfer")).toBe("Bank transfer");
  });

  it("requires all accounting readiness flags and safe permission", () => {
    const ready = readySafeSummary();
    expect(isPayrollSafeAccountingReady(ready)).toBe(true);
    expect(
      isPayrollSafeAccountingReady(
        readySafeSummary({ finance_accounting_enabled: false }),
      ),
    ).toBe(false);
    expect(
      isPayrollSafeAccountingReady(
        readySafeSummary({ accounting_v2_enabled: false }),
      ),
    ).toBe(false);
    expect(
      isPayrollSafeAccountingReady(
        readySafeSummary({ ledger_complete: false }),
      ),
    ).toBe(false);
    expect(
      canUsePayrollSafe({
        summary: ready,
        hasDisbursementPermission: true,
      }),
    ).toBe(true);
    expect(
      canUsePayrollSafe({
        summary: ready,
        hasDisbursementPermission: false,
      }),
    ).toBe(false);
  });

  it("validates safe permission, reference, and verified balance", () => {
    const summary = readySafeSummary({ safe_cash: 5000 });
    expect(
      payrollSafeFundingError({
        summary,
        hasDisbursementPermission: false,
        reference: "SAFE-1",
        amount: 1000,
      }),
    ).toContain("permission");
    expect(
      payrollSafeFundingError({
        summary,
        hasDisbursementPermission: true,
        reference: "",
        amount: 1000,
      }),
    ).toContain("reference");
    expect(
      payrollSafeFundingError({
        summary,
        hasDisbursementPermission: true,
        reference: "SAFE-1",
        amount: 6000,
      }),
    ).toContain("exceeds");
    expect(
      payrollSafeFundingError({
        summary,
        hasDisbursementPermission: true,
        reference: "SAFE-1",
        amount: 5000,
      }),
    ).toBeNull();
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

  it("labels safe-funded payments from the persisted source snapshot", () => {
    expect(
      payrollPaymentSourceLabel({
        id: 2,
        restaurant_id: 52,
        staff_id: 9,
        amount: 1000,
        payment_method: "cash",
        cash_source: "safe",
        cash_source_name: "Main Cash / Safe (1005)",
        paid_at: "2026-07-15T10:00:00Z",
        status: "posted",
        allocations: [],
      } satisfies PayrollPayment),
    ).toBe("Main Cash / Safe (1005)");
  });

  it("does not invent an exact funding source for reconstructed legacy records", () => {
    expect(
      payrollPaymentSourceLabel({
        id: -7,
        restaurant_id: 52,
        staff_id: 9,
        amount: 1000,
        payment_method: "cash",
        paid_at: "2026-01-15T10:00:00Z",
        status: "posted",
        metadata_reconstructed: true,
        history_quality: "partial",
        allocations: [],
      } satisfies PayrollPayment),
    ).toBe("Legacy source unavailable");
  });

  it("allocates tax remittance to the oldest payroll run first", () => {
    expect(
      previewPayrollTaxAllocations(
        [
          {
            payroll_run_id: 20,
            date_from: "2026-06-01",
            date_to: "2026-06-30",
            status: "approved",
            accrued_tax: 3000,
            remitted_tax: 0,
            outstanding_tax: 3000,
          },
          {
            payroll_run_id: 10,
            date_from: "2026-05-01",
            date_to: "2026-05-31",
            status: "paid",
            accrued_tax: 2000,
            remitted_tax: 500,
            outstanding_tax: 1500,
          },
        ],
        2000,
      ),
    ).toEqual([
      expect.objectContaining({
        payrollRunId: 10,
        amount: 1500,
        balanceAfter: 0,
      }),
      expect.objectContaining({
        payrollRunId: 20,
        amount: 500,
        balanceAfter: 2500,
      }),
    ]);
  });

  it("explains atomic run-payment failures without overstating network errors", () => {
    expect(
      payrollRunPaymentErrorMessage({
        response: { data: { detail: "Safe balance is insufficient" } },
      }),
    ).toContain(
      "No employee payments were recorded. Safe balance is insufficient",
    );
    expect(payrollRunPaymentErrorMessage(new Error("offline"))).toContain(
      "Refresh the payroll run",
    );
  });
});
