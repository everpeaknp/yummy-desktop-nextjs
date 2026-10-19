export type Presence = "working" | "completed" | "not_started" | "not_arrived" | "absent" | "leave" | "holiday" | "day_off" | "unassigned" | "not_employed";
export const presenceLabels: Record<Presence, string> = {
  working: "Working now", completed: "Attendance recorded", not_started: "Not started",
  not_arrived: "Not arrived", absent: "Absent", leave: "On leave", holiday: "Holiday",
  day_off: "Day off", unassigned: "No schedule", not_employed: "Outside employment",
};
export type RegisterDay = {
  date: string; schedule_kind: "shift" | "day_off" | "unassigned";
  shift_name: string | null; scheduled_start_at: string | null; scheduled_end_at: string | null;
  presence: Presence; attended: boolean; carryover: boolean; employed: boolean;
  clock_in_at: string | null; clock_out_at: string | null;
  regular_minutes: number; overtime_minutes: number; eligible_regular_minutes: number; eligible_overtime_minutes: number;
  break_minutes: number; late_minutes: number; early_minutes: number; review_count: number; excluded_count: number;
  paid_leave_days: number; unpaid_leave_days: number; holiday: string | null;
  entries: { id: number; clock_in_at: string; clock_out_at: string | null; approval_status: string; exception_code: string | null; regular_minutes: number; overtime_minutes: number }[];
};
export type RegisterStaff = { staff_id: number; user_id: number; staff_name: string; summary: Record<string, number>; days: RegisterDay[] };
export type AttendanceRegister = { date_from: string; date_to: string; timezone: string; as_of: string; rows: RegisterStaff[] };

export function localDate(timezone?: string, now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function shiftDate(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
// Timesheets filter actual clock-in dates; the register groups by scheduled work date.
export function timesheetRange(day: RegisterDay, timezone?: string) {
  const dates = day.entries.map(entry => localDate(timezone, new Date(entry.clock_in_at))).sort();
  return { from: dates[0] || day.date, to: dates[dates.length - 1] || day.date };
}
export function rangeError(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return "Choose both dates.";
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  if (!Number.isFinite(days) || days < 0) return "End date must be on or after start date.";
  return days > 92 ? "Choose up to 93 days at a time." : null;
}
export function duration(minutes: number) { return Number.isFinite(minutes) ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m` : "—"; }
export function registerCsv(rows: RegisterStaff[]) {
  const headers = ["Staff", "Work date", "Presence", "Shift", "Clock in (ISO timestamp)", "Clock out (ISO timestamp)", "Recorded regular minutes", "Recorded overtime minutes", "Approved regular minutes", "Approved overtime minutes", "Review items", "Excluded entries", "Paid leave days", "Unpaid leave days", "Holiday", "Day off", "No schedule", "Scheduled start (ISO timestamp)", "Scheduled end (ISO timestamp)", "Break minutes", "Late minutes", "Early departure minutes"];
  const records = rows.flatMap(staff => staff.days.map(d => [staff.staff_name, d.date, presenceLabels[d.presence], d.shift_name || d.schedule_kind,
    d.clock_in_at, d.clock_out_at, d.regular_minutes, d.overtime_minutes, d.eligible_regular_minutes, d.eligible_overtime_minutes,
    d.review_count, d.excluded_count, d.paid_leave_days, d.unpaid_leave_days, d.holiday, d.schedule_kind === "day_off", d.schedule_kind === "unassigned",
    d.scheduled_start_at, d.scheduled_end_at, d.break_minutes, d.late_minutes, d.early_minutes]));
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [headers, ...records].map(row => row.map(cell).join(",")).join("\r\n");
}
