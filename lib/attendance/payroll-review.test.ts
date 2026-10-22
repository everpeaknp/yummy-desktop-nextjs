import { describe, expect, it } from "vitest";
import { payrollReviewFixture } from "@/components/attendance/payroll-review.fixture";
import { payrollEstimateCsv, payrollTotal, validatePayrollRows } from "./payroll-review";

describe("earnings review", () => {
  it("exports the displayed period estimate and its calculation notes", () => {
    const csv = payrollEstimateCsv([{ ...payrollReviewFixture, staff_name: '=HYPERLINK("bad")' }]);
    expect(csv).toContain("Estimated earnings"); expect(csv).toContain("3300");
    expect(csv).toContain("Hourly overtime is included"); expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain("regular_minutes");
  });
  it("rejects missing amounts instead of making them zero", () => {
    expect(() => validatePayrollRows([{ ...payrollReviewFixture, estimated_payable: undefined! }])).toThrow("unavailable amount");
    expect(() => validatePayrollRows([{ ...payrollReviewFixture, days: undefined! }])).toThrow("Update the backend");
  });
  it("adds cent-rounded estimates rather than concatenating Decimal strings", () => {
    expect(payrollTotal([{ ...payrollReviewFixture, estimated_payable: "0.1" as unknown as number }, { ...payrollReviewFixture, estimated_payable: "0.2" as unknown as number }])).toBe(0.3);
  });
  it("does not display a calculation that fails to reconcile", () => {
    expect(() => validatePayrollRows([{ ...payrollReviewFixture, estimated_payable: 999 }])).toThrow("does not match");
  });
});
