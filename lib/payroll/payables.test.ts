import { beforeEach, describe, expect, it, vi } from "vitest";
import { payrollPayablesApi } from "./payables";

vi.mock("@/lib/api-client", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import apiClient from "@/lib/api-client";

const mocked = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("payrollPayablesApi", () => {
  it("loads the automatic due summary and a staff balance", async () => {
    mocked.get
      .mockResolvedValueOnce({
        data: { data: { total_outstanding: 30000, staff: [] } },
      })
      .mockResolvedValueOnce({
        data: { data: { staff_id: 9, total_outstanding: 30000 } },
      });

    const summary = await payrollPayablesApi.dueSummary("2026-07-15");
    const balance = await payrollPayablesApi.staffBalance(9, "2026-07-15");

    expect(mocked.get).toHaveBeenNthCalledWith(
      1,
      "/payroll/due-summary?as_of=2026-07-15",
    );
    expect(mocked.get).toHaveBeenNthCalledWith(
      2,
      "/payroll/staff/9/balance?as_of=2026-07-15",
    );
    expect(summary.total_outstanding).toBe(30000);
    expect(balance.staff_id).toBe(9);
  });

  it("records a partial payment without forcing a date range", async () => {
    mocked.post.mockResolvedValueOnce({
      data: { data: { id: 7, staff_id: 9, amount: 10000 } },
    });

    await payrollPayablesApi.recordPayment({
      staff_id: 9,
      amount: 10000,
      payment_method: "bank_transfer",
      payment_bank_id: 3,
      payment_reference: "TXN-100",
    });

    expect(mocked.post).toHaveBeenCalledWith("/payroll/payments", {
      staff_id: 9,
      amount: 10000,
      payment_method: "bank_transfer",
      payment_bank_id: 3,
      payment_reference: "TXN-100",
    });
  });

  it("records the cash drawer funding a salary payment", async () => {
    mocked.post.mockResolvedValueOnce({
      data: { data: { id: 8, staff_id: 9, amount: 5000 } },
    });

    await payrollPayablesApi.recordPayment({
      staff_id: 9,
      amount: 5000,
      payment_method: "cash",
      cash_source: "drawer",
      drawer_session_id: 41,
    });

    expect(mocked.post).toHaveBeenCalledWith("/payroll/payments", {
      staff_id: 9,
      amount: 5000,
      payment_method: "cash",
      cash_source: "drawer",
      drawer_session_id: 41,
    });
  });

  it("records a safe-funded salary payment with an audit reference", async () => {
    mocked.post.mockResolvedValueOnce({
      data: { data: { id: 9, staff_id: 9, amount: 5000 } },
    });

    await payrollPayablesApi.recordPayment({
      staff_id: 9,
      amount: 5000,
      payment_method: "cash",
      cash_source: "safe",
      payment_reference: "SAFE-VOUCHER-9",
    });

    expect(mocked.post).toHaveBeenCalledWith("/payroll/payments", {
      staff_id: 9,
      amount: 5000,
      payment_method: "cash",
      cash_source: "safe",
      payment_reference: "SAFE-VOUCHER-9",
    });
  });

  it("saves the restaurant payroll schedule", async () => {
    mocked.put.mockResolvedValueOnce({
      data: { data: { id: 3, frequency: "monthly" } },
    });

    await payrollPayablesApi.saveSchedule({
      frequency: "monthly",
      period_start_day: 1,
      payment_delay_days: 1,
      effective_from: "2026-04-01",
      is_active: true,
    });

    expect(mocked.put).toHaveBeenCalledWith("/payroll/schedules", {
      frequency: "monthly",
      period_start_day: 1,
      payment_delay_days: 1,
      effective_from: "2026-04-01",
      is_active: true,
    });
  });

  it("loads setup readiness and bulk prepares all ready periods", async () => {
    mocked.get.mockResolvedValueOnce({
      data: { data: { staff_total: 6, staff_ready: 5, staff: [] } },
    });
    mocked.post.mockResolvedValueOnce({
      data: { data: { created_run_count: 2, prepared_staff_count: 5 } },
    });

    const readiness = await payrollPayablesApi.setupReadiness("2026-07-15");
    const result = await payrollPayablesApi.bulkPrepare({
      as_of: "2026-07-15",
    });

    expect(mocked.get).toHaveBeenCalledWith(
      "/payroll/setup-readiness?as_of=2026-07-15",
    );
    expect(mocked.post).toHaveBeenCalledWith("/payroll/runs/bulk-prepare", {
      as_of: "2026-07-15",
    });
    expect(readiness.staff_ready).toBe(5);
    expect(result.prepared_staff_count).toBe(5);
  });

  it("reverses a posted payment with an audit reason", async () => {
    mocked.post.mockResolvedValueOnce({
      data: { data: { id: 7, status: "reversed" } },
    });

    await payrollPayablesApi.reversePayment(7, "Duplicate payment");

    expect(mocked.post).toHaveBeenCalledWith("/payroll/payments/7/reverse", {
      reason: "Duplicate payment",
    });
  });

  it("can direct a cash reversal to an open drawer", async () => {
    mocked.post.mockResolvedValueOnce({
      data: { data: { id: 7, status: "reversed" } },
    });

    await payrollPayablesApi.reversePayment(7, "Wrong employee", 52);

    expect(mocked.post).toHaveBeenCalledWith("/payroll/payments/7/reverse", {
      reason: "Wrong employee",
      drawer_session_id: 52,
    });
  });

  it("loads liability and records and reverses a tax remittance", async () => {
    mocked.get
      .mockResolvedValueOnce({
        data: {
          data: {
            accrued_tax: 5000,
            remitted_tax: 1000,
            outstanding_tax: 4000,
            runs: [],
          },
        },
      })
      .mockResolvedValueOnce({ data: { data: [] } });
    mocked.post
      .mockResolvedValueOnce({
        data: { data: { id: 11, amount: 2000, status: "posted" } },
      })
      .mockResolvedValueOnce({
        data: { data: { id: 11, amount: 2000, status: "reversed" } },
      });

    const liability = await payrollPayablesApi.taxLiability("2026-07-16");
    await payrollPayablesApi.taxRemittances(50);
    await payrollPayablesApi.recordTaxRemittance({
      amount: 2000,
      payment_method: "bank_transfer",
      payment_bank_id: 3,
      payment_reference: "TAX-2000",
      allocations: [{ payroll_run_id: 7, amount: 2000 }],
    });
    await payrollPayablesApi.reverseTaxRemittance(11, "Duplicate remittance");

    expect(mocked.get).toHaveBeenNthCalledWith(
      1,
      "/payroll/tax-liability?as_of=2026-07-16",
    );
    expect(mocked.get).toHaveBeenNthCalledWith(
      2,
      "/payroll/tax-remittances?limit=50",
    );
    expect(mocked.post).toHaveBeenNthCalledWith(
      1,
      "/payroll/tax-remittances",
      {
        amount: 2000,
        payment_method: "bank_transfer",
        payment_bank_id: 3,
        payment_reference: "TAX-2000",
        allocations: [{ payroll_run_id: 7, amount: 2000 }],
      },
    );
    expect(mocked.post).toHaveBeenNthCalledWith(
      2,
      "/payroll/tax-remittances/11/reverse",
      { reason: "Duplicate remittance" },
    );
    expect(liability.outstanding_tax).toBe(4000);
  });
});
