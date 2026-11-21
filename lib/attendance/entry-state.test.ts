import { describe, expect, it } from "vitest";
import { isActiveAttendanceEntry } from "./entry-state";

describe("active attendance", () => {
  it("keeps an unresolved current shift active until explicitly superseded", () => {
    expect(isActiveAttendanceEntry({ status: "missing_checkout", clock_out_at: null })).toBe(true);
    expect(isActiveAttendanceEntry({ status: "missing_checkout", clock_out_at: null, superseded_at: "2026-11-19T03:15:00Z" })).toBe(false);
  });
  it("excludes void and closed records even if their status is inconsistent", () => {
    expect(isActiveAttendanceEntry({ status: "void", clock_out_at: null })).toBe(false);
    expect(isActiveAttendanceEntry({ status: "open", clock_out_at: "2026-11-19T12:15:00Z" })).toBe(false);
  });
});
