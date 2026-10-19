import { describe, expect, it } from "vitest";
import { duration, localDate, rangeError, registerCsv, shiftDate, timesheetRange, RegisterDay, RegisterStaff } from "./register";

describe("attendance register", () => {
  it("links overnight work dates to the actual clock-in date used by timesheets", () => {
    expect(timesheetRange({ date: "2026-10-19", entries: [{ clock_in_at: "2026-10-19T20:00:00Z" }] } as RegisterDay, "Asia/Kathmandu")).toEqual({ from: "2026-10-20", to: "2026-10-20" });
  });
  it("uses restaurant local dates around midnight", () => {
    expect(localDate("Asia/Kathmandu", new Date("2026-10-19T20:00:00Z"))).toBe("2026-10-20");
    expect(shiftDate("2026-11-01", -1)).toBe("2026-10-31");
  });
  it("bounds report ranges without forcing month boundaries", () => {
    expect(rangeError("2026-09-17", "2026-10-16")).toBeNull();
    expect(rangeError("2026-10-20", "2026-10-19")).toBeTruthy();
    expect(rangeError("", "2026-10-19")).toBeTruthy();
    expect(rangeError("2026-01-01", "2026-12-31")).toBeTruthy();
  });
  it("does not round short attendance to zero hours", () => {
    expect(duration(4)).toBe("0h 04m");
    expect(duration(90)).toBe("1h 30m");
    expect(duration(NaN)).toBe("—");
  });
  it("exports daily records, not just the displayed page, and protects spreadsheet cells", () => {
    const staff = { staff_name: '=HYPERLINK("bad")', days: [{ date: "2026-10-20", presence: "completed", schedule_kind: "shift", regular_minutes: 4, eligible_regular_minutes: 0, review_count: 1 }] } as RegisterStaff;
    const csv = registerCsv([staff]);
    expect(csv).toContain("Approved regular minutes");
    expect(csv).toContain("' =".replace(" ", ""));
    expect(csv).toContain("Attendance recorded");
  });
});
