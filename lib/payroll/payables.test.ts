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
      payment_reference: "TXN-100",
    });

    expect(mocked.post).toHaveBeenCalledWith("/payroll/payments", {
      staff_id: 9,
      amount: 10000,
      payment_method: "bank_transfer",
      payment_reference: "TXN-100",
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
});
