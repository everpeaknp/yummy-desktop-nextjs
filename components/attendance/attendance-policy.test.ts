import { describe, expect, it } from "vitest";

import { attendanceLocationState, attendanceRadiusLabel } from "./attendance-policy";

describe("attendance policy", () => {
  it("requires restaurant profile coordinates", () => {
    expect(attendanceLocationState(null, null)).toBe("missing");
    expect(attendanceLocationState(27.7172, null)).toBe("missing");
    expect(attendanceLocationState(27.7172, 85.324)).toBe("configured");
  });

  it("labels practical radius ranges", () => {
    expect(attendanceRadiusLabel(50)).toBe("Small venue");
    expect(attendanceRadiusLabel(150)).toBe("Typical restaurant");
    expect(attendanceRadiusLabel(500)).toBe("Large property");
    expect(attendanceRadiusLabel(900)).toBe("Extended site");
  });
});
