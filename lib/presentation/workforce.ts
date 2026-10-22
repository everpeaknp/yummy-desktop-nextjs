import type {
  AttendanceApprovalStatus,
  AttendanceStatus,
} from "@/lib/attendance/types";

const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  open: "Clocked in",
  complete: "Clocked out",
  missing_checkout: "Missing clock-out",
  adjusted: "Adjusted",
  void: "Voided",
};

const attendanceApprovalLabels: Record<AttendanceApprovalStatus, string> = {
  draft: "Draft",
  pending: "Ready for review",
  approved: "Approved",
  rejected: "Rejected",
  needs_correction: "Needs correction",
  payroll_exported: "Sent to payroll",
};

export function attendanceStatusLabel(status: AttendanceStatus) {
  return attendanceStatusLabels[status];
}

export function attendanceApprovalLabel(status: AttendanceApprovalStatus) {
  return attendanceApprovalLabels[status];
}

/** Backend exception codes are authoritative; presentation only improves readability. */
export function attendanceExceptionLabel(code?: string | null) {
  if (!code) return null;
  return code
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
