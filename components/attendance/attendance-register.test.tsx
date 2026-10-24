import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceRegister } from "./attendance-register";
import { attendanceApi } from "@/lib/attendance/api";
import type { AttendanceRegister as Register } from "@/lib/attendance/register";

vi.mock("@/lib/attendance/api", () => ({ attendanceApi: { register: vi.fn() } }));
const report: Register = {
  date_from: "2026-10-01", date_to: "2026-10-20", timezone: "Asia/Kathmandu", as_of: "2026-10-20T12:00:00Z",
  rows: [{ staff_id: 3, user_id: 8, staff_name: "Niraj", summary: { attended_days: 1, scheduled_days: 1, absent_days: 0, paid_leave_days: 0, unpaid_leave_days: 0, eligible_regular_minutes: 0, eligible_overtime_minutes: 0, review_count: 1 }, days: [{
    date: "2026-10-20", schedule_kind: "shift", shift_name: "Morning", scheduled_start_at: "2026-10-20T03:00:00Z", scheduled_end_at: "2026-10-20T11:00:00Z",
    presence: "completed", attended: true, carryover: false, employed: true, clock_in_at: "2026-10-20T03:00:00Z", clock_out_at: "2026-10-20T03:04:00Z",
    regular_minutes: 4, overtime_minutes: 0, eligible_regular_minutes: 0, eligible_overtime_minutes: 0, break_minutes: 0, late_minutes: 0, early_minutes: 0, review_count: 1, excluded_count: 0, paid_leave_days: 0, unpaid_leave_days: 0, holiday: null,
    entries: [{ id: 7, clock_in_at: "2026-10-20T03:00:00Z", clock_out_at: "2026-10-20T03:04:00Z", approval_status: "pending", exception_code: "unscheduled_shift", regular_minutes: 4, overtime_minutes: 0 }],
  }] }],
};
beforeEach(() => { vi.mocked(attendanceApi.register).mockReset().mockResolvedValue(report); });
describe("AttendanceRegister", () => {
  it("keeps individual mobile history compact and can reveal every day", async () => {
    vi.mocked(attendanceApi.register).mockResolvedValue({ ...report, rows: [{ ...report.rows[0], days: Array.from({ length: 10 }, (_, index) => ({ ...report.rows[0].days[0], date: `2026-10-${String(index + 1).padStart(2, "0")}` })) }] });
    render(<AttendanceRegister staffId={3} />);
    const more = await screen.findByRole("button", { name: "View all 10 days" });
    expect(screen.getAllByRole("button", { name: /Attendance recorded/ })).toHaveLength(7);
    fireEvent.click(more);
    expect(screen.getByRole("dialog", { name: "Attendance history" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Attendance recorded/ })).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getAllByRole("button", { name: /Attendance recorded/ })).toHaveLength(7);
    expect(screen.getByRole("button", { name: "View all 10 days" })).toBeInTheDocument();
  });

  it("scopes summary totals to the selected employee", async () => {
    vi.mocked(attendanceApi.register).mockResolvedValue({ ...report, rows: [...report.rows, { ...report.rows[0], staff_id: 4, staff_name: "Mandeep", summary: { ...report.rows[0].summary, attended_days: 5 } }] });
    render(<AttendanceRegister />);
    await screen.findByRole("button", { name: "Niraj" });
    const attendedTotal = () => screen.getByText("Attended days").closest("div")?.querySelector("dd");
    expect(attendedTotal()).toHaveTextContent("6");
    fireEvent.click(screen.getByRole("button", { name: "Niraj" }));
    expect(attendedTotal()).toHaveTextContent("1");
  });
  it("opens staff daily breakdown and keeps the timesheet context", async () => {
    render(<AttendanceRegister />);
    fireEvent.click(await screen.findByRole("button", { name: "Niraj" }));
    expect((await screen.findAllByText("Attendance recorded", { selector: "div" })).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Niraj.*20/ })[0]);
    expect(await screen.findByRole("link", { name: "View timesheets" })).toHaveAttribute("href", "/attendance?tab=timesheets&staff_id=3&from=2026-10-20&to=2026-10-20");
  });
  it("self mode has no management link or export", async () => {
    render(<AttendanceRegister own />);
    fireEvent.click(await screen.findByRole("button", { name: /Niraj.*20/ }));
    expect(screen.queryByRole("link", { name: "View timesheets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(attendanceApi.register).toHaveBeenCalledWith(expect.objectContaining({ own: true }));
  });
  it("shows separate QR devices in an individual record", async () => {
    vi.mocked(attendanceApi.register).mockResolvedValue({
      ...report,
      rows: [{ ...report.rows[0], days: [{
        ...report.rows[0].days[0],
        entries: [{ ...report.rows[0].days[0].entries[0], source: "qr_mobile",
          clock_in_device_name: "Front desk phone (#4)",
          clock_out_device_name: "Kitchen phone (#9)" }],
      }] }],
    });
    render(<AttendanceRegister own />);
    fireEvent.click(await screen.findByRole("button", { name: /Niraj.*20/ }));
    expect(screen.getByText(/Clock-in device: Front desk phone \(#4\).*Clock-out device: Kitchen phone \(#9\)/)).toBeInTheDocument();
  });
  it("labels missing evidence without implying a completed clock-out", async () => {
    vi.mocked(attendanceApi.register).mockResolvedValue({
      ...report,
      rows: [{ ...report.rows[0], days: [{
        ...report.rows[0].days[0],
        entries: [{ ...report.rows[0].days[0].entries[0], source: "qr_mobile", clock_out_at: null }],
      }] }],
    });
    render(<AttendanceRegister own />);
    fireEvent.click(await screen.findByRole("button", { name: /Niraj.*20/ }));
    expect(screen.getByText(/Clock-in device: Device not recorded.*Clock-out device: Awaiting clock-out/)).toBeInTheDocument();
  });
  it("shows failure instead of empty results and supports retry", async () => {
    vi.mocked(attendanceApi.register).mockRejectedValueOnce(new Error("offline"));
    render(<AttendanceRegister />);
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.queryByText("No matching attendance.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Niraj" })).toBeInTheDocument();
  });
  it("does not let an older request overwrite a newer range", async () => {
    let resolveOld!: (value: Register) => void;
    vi.mocked(attendanceApi.register).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    render(<AttendanceRegister />);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-22" } });
    await screen.findByRole("button", { name: "Niraj" });
    resolveOld({ ...report, rows: [{ ...report.rows[0], staff_name: "Old response" }] });
    await waitFor(() => expect(screen.queryByText("Old response")).not.toBeInTheDocument());
  });
});
