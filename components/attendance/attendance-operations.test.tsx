import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { attendanceApi } from "@/lib/attendance/api";
import { AttendanceReviewQueue, AttendanceDeviceDiagnostics } from "./attendance-operations";
import { PagedTimesheets } from "./paged-timesheets";
import { PayrollAdjustmentControls } from "./payroll-adjustment-controls";
import { payrollReviewFixture } from "./payroll-review.fixture";

vi.mock("@/lib/attendance/api", () => ({ attendanceApi: { operationsPage: vi.fn(), diagnostics: vi.fn(), rawPunches: vi.fn(), dismissPunch: vi.fn(), recoverPunches: vi.fn(), adjustPayroll: vi.fn(), reversePayrollAdjustment: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

it("paginates exceptions on the server and retains the selected date range", async () => {
  vi.mocked(attendanceApi.operationsPage).mockResolvedValue({ items: [], total: 30, offset: 0, limit: 25 });
  render(<AttendanceReviewQueue from="2026-11-01" to="2026-11-23" canDevices={false} />);
  fireEvent.click(await screen.findByRole("button", { name: "Next" }));
  await waitFor(() => expect(attendanceApi.operationsPage).toHaveBeenLastCalledWith("exceptions", expect.objectContaining({ offset: 25, date_from: "2026-11-01", date_to: "2026-11-23" })));
});

it("shows an API failure instead of a healthy device state", async () => {
  vi.mocked(attendanceApi.diagnostics).mockRejectedValue(new Error("Device diagnostics unavailable"));
  render(<AttendanceDeviceDiagnostics />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Device diagnostics unavailable");
  expect(screen.queryByText("online")).not.toBeInTheDocument();
});

it("filters server-paged entries before rendering and supports refresh", async () => {
  vi.mocked(attendanceApi.operationsPage).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 });
  render(<PagedTimesheets from="2026-11-01" to="2026-11-02" staffId={7} version={1}>{rows => <p>{rows.length} rows</p>}</PagedTimesheets>);
  await screen.findByText("0 rows");
  fireEvent.change(screen.getByRole("combobox", { name: "Approval status" }), { target: { value: "pending" } });
  await waitFor(() => expect(attendanceApi.operationsPage).toHaveBeenLastCalledWith("entries/page", expect.objectContaining({ approval: "pending", staff_id: 7, limit: 50 })));
});

it("records signed adjustments with a reason and reloads finalized earnings", async () => {
  vi.mocked(attendanceApi.adjustPayroll).mockResolvedValue({});
  const onSaved = vi.fn();
  render(<PayrollAdjustmentControls row={{ ...payrollReviewFixture, days: [{ ...payrollReviewFixture.days[0], payroll_finalized: true }] }} onSaved={onSaved} />);
  fireEvent.click(screen.getByText("Adjust finalized earnings"));
  fireEvent.change(screen.getByLabelText("Signed amount"), { target: { value: "-10.50" } });
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Correct approved daily allowance" } });
  fireEvent.click(screen.getByRole("button", { name: "Record earnings adjustment" }));
  await waitFor(() => expect(attendanceApi.adjustPayroll).toHaveBeenCalledWith(expect.objectContaining({ staff_id: payrollReviewFixture.staff_id, amount: "-10.50", reason: "Correct approved daily allowance" })));
  expect(onSaved).toHaveBeenCalledOnce();
});
