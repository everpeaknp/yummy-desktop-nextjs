import { describe, expect, it } from "vitest";

import { payrollRowsToCsv } from "@/lib/attendance/payroll-export";

describe("payroll export CSV", () => {
  it("writes stable columns and quotes commas and quotes in cell values", () => {
    expect(
      payrollRowsToCsv([
        { staff_id: 7, name: 'Doe, "Jane"', regular_minutes: 480 },
        { staff_id: 8, name: "Alex", regular_minutes: 420 },
      ]),
    ).toBe('staff_id,name,regular_minutes\n7,"Doe, ""Jane""",480\n8,Alex,420');
  });

  it("returns an empty string when there are no approved payroll rows", () => {
    expect(payrollRowsToCsv([])).toBe("");
  });
});
