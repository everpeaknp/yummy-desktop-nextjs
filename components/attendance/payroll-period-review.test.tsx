import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attendanceApi } from "@/lib/attendance/api";
import { PayrollPeriodReview } from "./payroll-period-review";
import { payrollReviewFixture } from "./payroll-review.fixture";

vi.mock("@/lib/attendance/api", () => ({ attendanceApi: { payrollPeriod: vi.fn() } }));
beforeEach(() => { vi.mocked(attendanceApi.payrollPeriod).mockReset().mockResolvedValue([payrollReviewFixture]); });

describe("PayrollPeriodReview", () => {
  it("keeps the daily calculation collapsed until requested", async () => {
    render(<PayrollPeriodReview own />);
    const button = await screen.findByRole("button", { name: /View daily calculation/ });
    expect(screen.queryByRole("dialog", { name: "Daily earnings calculation" })).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Daily earnings calculation" })).toBeInTheDocument();
  });

  it("opens calculation notes and links to the employee salary account", async () => {
    render(<PayrollPeriodReview canExport canViewAttendance canOpenStaff />);
    fireEvent.click(await screen.findByRole("button", { name: "QA Hourly" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Hourly overtime is included in these earnings");
    expect(screen.getByRole("link", { name: "Open salary account" })).toHaveAttribute("href", "/staff/8?tab=financials");
    fireEvent.click(screen.getByRole("button", { name: /View daily calculation/ }));
    expect(screen.getByRole("dialog", { name: "Daily earnings calculation" })).toHaveTextContent("No approved completed attendance");
  });
  it("self reports exclude manager and export actions", async () => {
    render(<PayrollPeriodReview own />);
    await screen.findByText("Estimated period earnings");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export earnings CSV" })).not.toBeInTheDocument();
    expect(attendanceApi.payrollPeriod).toHaveBeenCalledWith(expect.any(String), expect.any(String), { own: true, staffId: undefined });
  });
  it("shows failed loads and retries instead of displaying a zero", async () => {
    vi.mocked(attendanceApi.payrollPeriod).mockRejectedValueOnce(new Error("Offline. Retry the report."));
    render(<PayrollPeriodReview />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
    expect(screen.queryByText("Estimated earnings")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "QA Hourly" })).toBeInTheDocument();
  });
});
