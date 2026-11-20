import type { AttendanceEntry } from "./types";

export function isActiveAttendanceEntry(
  entry: Pick<AttendanceEntry, "status" | "clock_out_at" | "superseded_at">,
) {
  return entry.status !== "void" && !entry.clock_out_at && !entry.superseded_at;
}
