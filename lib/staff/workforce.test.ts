import { beforeEach, describe, expect, it, vi } from "vitest";
import { staffWorkforceApi } from "./workforce";

vi.mock("@/lib/api-client", () => ({
  default: { get: vi.fn() },
}));

import apiClient from "@/lib/api-client";

const mocked = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("staffWorkforceApi", () => {
  it("resolves the canonical staff profile from a user id", async () => {
    mocked.get.mockResolvedValueOnce({
      data: {
        data: [
          { id: 8, user_id: 20, account_number: "A-8" },
          { id: 9, user_id: 21, account_number: "A-9" },
        ],
      },
    });

    const profile = await staffWorkforceApi.profileByUserId(21);

    expect(mocked.get).toHaveBeenCalledWith("/staff?skip=0&limit=500");
    expect(profile?.id).toBe(9);
  });

  it("loads effective salary and payroll history by staff id", async () => {
    mocked.get
      .mockResolvedValueOnce({ data: { data: [{ id: 1, staff_id: 9 }] } })
      .mockResolvedValueOnce({ data: { data: [{ run: { id: 4 }, item: { id: 7, staff_id: 9 } }] } });

    await staffWorkforceApi.salaryHistory(9);
    await staffWorkforceApi.payrollHistory(9);

    expect(mocked.get).toHaveBeenNthCalledWith(1, "/staff/9/salary-history");
    expect(mocked.get).toHaveBeenNthCalledWith(2, "/payroll/staff/9/history");
  });
});
