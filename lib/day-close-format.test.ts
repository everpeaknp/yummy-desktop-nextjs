import { describe, expect, it } from "vitest";

import {
  formatDayCloseCurrency,
  formatDayCloseNumber,
  pickBackendAmount,
} from "./day-close-format";

describe("day close formatters", () => {
  it("formats backend decimal strings as currency", () => {
    expect(formatDayCloseCurrency("600.00")).toBe("Rs. 600.00");
    expect(formatDayCloseCurrency("-100.5")).toBe("Rs. -100.50");
  });

  it("formats backend decimal strings as plain numbers", () => {
    expect(formatDayCloseNumber("600.25")).toBe("600.25");
  });

  it("picks numeric backend strings before falling back", () => {
    expect(pickBackendAmount(undefined, null, "500.00", 0)).toBe(500);
  });

  it("keeps invalid values as unavailable", () => {
    expect(formatDayCloseCurrency("not-a-number")).toBe("—");
    expect(formatDayCloseNumber("")).toBe("—");
  });
});
