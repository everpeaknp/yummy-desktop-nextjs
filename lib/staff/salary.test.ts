import { beforeEach, describe, expect, it, vi } from "vitest";
import { staffSalaryApi } from "./salary";

vi.mock("@/lib/api-client", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import apiClient from "@/lib/api-client";

const mocked = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("staffSalaryApi", () => {
  it("fetches the salary balance for a staff member", async () => {
    mocked.get.mockResolvedValueOnce({
      data: { data: { staff_id: 9, mode: "flat", accrued: 3000, paid: 1000, deducted: 0, balance: 2000, daily_rate: 1000 } },
    });

    const balance = await staffSalaryApi.balance(9);

    expect(mocked.get).toHaveBeenCalledWith("/staff/9/salary/balance");
    expect(balance.balance).toBe(2000);
  });

  it("pays salary against the accrued balance", async () => {
    mocked.post.mockResolvedValueOnce({
      data: { data: { id: 1, staff_id: 9, direction: "salary_paid", amount: 500, status: "posted", created_at: "2026-08-01" } },
    });

    await staffSalaryApi.pay(9, {
      amount: 500,
      payment_method: "cash",
      account_type: "drawer",
      account_id: 14,
    });

    expect(mocked.post).toHaveBeenCalledWith("/staff/9/salary/pay", {
      amount: 500,
      payment_method: "cash",
      account_type: "drawer",
      account_id: 14,
    });
  });

  it("deducts salary with a required reason", async () => {
    mocked.post.mockResolvedValueOnce({
      data: { data: { id: 2, staff_id: 9, direction: "salary_deducted", amount: 200, status: "posted", created_at: "2026-08-01" } },
    });

    await staffSalaryApi.deduct(9, { amount: 200, reason: "Absent without notice" });

    expect(mocked.post).toHaveBeenCalledWith("/staff/9/salary/deduct", { amount: 200, reason: "Absent without notice" });
  });

  it("pays every staff member's outstanding balance in one call", async () => {
    mocked.post.mockResolvedValueOnce({ data: { data: { paid_count: 2, total_paid: "3000", staff: [] } } });

    const result = await staffSalaryApi.payAll({
      account_type: "bank",
      account_id: 8,
    });

    expect(mocked.post).toHaveBeenCalledWith("/staff/salary/pay-all", {
      account_type: "bank",
      account_id: 8,
    });
    expect(result.paid_count).toBe(2);
  });

  it("resolves overtime by paying it out at an hourly rate", async () => {
    mocked.post.mockResolvedValueOnce({
      data: { data: { staff_id: 9, resolved_minutes: 120, action: "pay", transaction_id: 3 } },
    });

    await staffSalaryApi.resolveOvertime(9, {
      action: "pay",
      hourly_rate: 300,
      account_type: "bank",
      account_id: 8,
    });

    expect(mocked.post).toHaveBeenCalledWith("/staff/9/salary/overtime/resolve", {
      action: "pay",
      hourly_rate: 300,
      account_type: "bank",
      account_id: 8,
    });
  });
});
