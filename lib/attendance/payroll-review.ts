import type { AttendancePayrollPreview, PayrollCalculationDay } from "./types";
import { payrollRowsToCsv } from "./payroll-export";

export const payrollReasons: Record<string, string> = {
  flat_salary: "Calendar-day salary", day_off: "Day off", unassigned: "No schedule assigned",
  paid_holiday: "Paid holiday", paid_leave: "Paid leave", unpaid_leave: "Unpaid leave",
  no_approved_time: "No approved completed attendance", hourly_work: "Approved hours and paid leave",
  salaried_work: "Attendance-adjusted daily pay", invalid_shift: "Invalid shift duration",
};
export const payrollWarnings: Record<string, string> = {
  current_agreement: "This estimate uses the current pay agreement. Earlier salary and attendance-mode changes are not applied to historical dates.",
  future_dates: "The selected dates include future days. The estimate includes projected pay for those dates.",
  unassigned: "Some dates have no schedule. The current calculation adds the daily rate on those dates; hourly staff have a zero daily rate, even if they worked.",
  hourly_without_attendance: "Hourly earnings are zero while attendance-based salary is off.",
  hourly_overtime_included: "Hourly overtime is included in these earnings. Check any separate overtime payments before paying the balance.",
};
export function payrollNumber(value: unknown): number {
  const number = typeof value === "number" || typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number)) throw new Error("The payroll response contains an unavailable amount. Refresh the report.");
  return number;
}
export function validatePayrollRows(rows: AttendancePayrollPreview[]) {
  for (const row of rows) {
    if (!Array.isArray(row.days) || !Array.isArray(row.warnings)) throw new Error("Detailed earnings are unavailable. Update the backend and refresh this report.");
    payrollNumber(row.estimated_payable); payrollNumber(row.salary_amount); payrollNumber(row.daily_rate);
    payrollNumber(row.review_count);
    for (const day of row.days) for (const key of ["amount", "units", "rate", "multiplier", "overtime_amount"] as const) payrollNumber(day[key]);
    const cents = row.days.reduce((total, day) => total + Math.round(payrollNumber(day.amount) * 100), 0);
    if (cents !== Math.round(payrollNumber(row.estimated_payable) * 100)) throw new Error("The daily calculation does not match the earnings total. Refresh the report before using this estimate.");
  }
  return rows;
}
export function payrollTotal(rows: AttendancePayrollPreview[]) {
  return rows.reduce((cents, row) => cents + Math.round(payrollNumber(row.estimated_payable) * 100), 0) / 100;
}
export function payrollEstimateCsv(rows: AttendancePayrollPreview[]) {
  return payrollRowsToCsv(rows.map(row => ({
    Staff: row.staff_name || `Staff #${row.staff_id}`, "From date": row.date_from, "To date": row.date_to,
    "Pay basis": row.salary_type, "Salary amount": row.salary_amount,
    Method: row.attendance_based_salary ? "Attendance" : "Calendar days", "Estimated earnings": row.estimated_payable,
    "Review items": row.review_count, "Daily rate": row.daily_rate,
    "Calculation notes": row.warnings.map(code => payrollWarnings[code] || code).join(" "),
  })));
}
export function calculationUnits(day: PayrollCalculationDay, salaryType: string | null) {
  const number = payrollNumber(day.units);
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(number)} ${salaryType === "hourly" && !["day_off", "unassigned"].includes(day.reason) ? "hours" : "days"}`;
}
