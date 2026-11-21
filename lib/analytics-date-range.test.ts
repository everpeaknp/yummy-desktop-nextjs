import { describe, expect, it } from "vitest";
import { analyticsDateRange } from "./analytics-date-range";
import { AnalyticsApis } from "./api/endpoints";

const oldSession = {
  period_start_at: "2026-08-07T00:00:00Z",
  period_end_at: "2026-11-20T10:00:00Z",
  business_line: "restaurant",
};
const base = { timezone: "Asia/Kathmandu", now: new Date("2026-11-19T19:00:00Z"), businessLine: "restaurant" };

describe("analytics calendar scope", () => {
  it("Today sends only the restaurant calendar date, not a rolling period", () => {
    const dates = analyticsDateRange({ ...base, preset: "today" });
    expect(dates.dateFrom).toBe("2026-11-20");
    expect(dates.dateTo).toBe("2026-11-20");
    for (const builder of [AnalyticsApis.dashboard, AnalyticsApis.financeSummary]) {
      const params = new URL(builder({ restaurantId: 7, ...dates }), "https://example.test").searchParams;
      expect(params.get("date_from")).toBe("2026-11-20");
      expect(params.get("date_to")).toBe("2026-11-20");
      expect(params.get("timezone")).toBe("Asia/Kathmandu");
      expect(params.has("start_time")).toBe(false);
      expect(params.has("end_time")).toBe(false);
    }
  });

  it("keeps the exact Daybook period only when explicitly selected", () => {
    const dates = analyticsDateRange({ ...base, preset: "today", selectedSession: oldSession });
    const params = new URL(AnalyticsApis.dashboard({ restaurantId: 7, ...dates }), "https://example.test").searchParams;
    expect(params.get("start_time")).toBe(oldSession.period_start_at);
    expect(params.get("end_time")).toBe(oldSession.period_end_at);
    expect(params.has("date_from")).toBe(false);
    expect(analyticsDateRange({ ...base, preset: "today", selectedSession: null }).startTime).toBeUndefined();
  });

  it.each([
    ["yesterday", "2026-11-19", "2026-11-19"],
    ["last7", "2026-11-14", "2026-11-20"],
    ["last30", "2026-10-22", "2026-11-20"],
    ["month", "2026-11-01", "2026-11-20"],
    ["lastMonth", "2026-10-01", "2026-10-31"],
    ["thisYear", "2026-01-01", "2026-11-20"],
    ["lastYear", "2025-01-01", "2025-12-31"],
    ["lifetime", "1970-01-01", "2026-11-20"],
  ] as const)("preserves the %s calendar range", (preset, from, to) => {
    expect(analyticsDateRange({ ...base, preset })).toMatchObject({ dateFrom: from, dateTo: to, startTime: undefined, endTime: undefined });
  });

  it("uses the previous restaurant date when the device's date is ahead", () => {
    expect(analyticsDateRange({ ...base, timezone: "America/Los_Angeles", preset: "today",
      now: new Date("2026-11-20T01:00:00Z") }).dateFrom).toBe("2026-11-19");
  });

  it("preserves explicit custom date/time selections", () => {
    const customRange = { from: new Date(2026, 10, 17, 9), to: new Date(2026, 10, 18, 18) };
    expect(analyticsDateRange({ ...base, preset: "custom", customRange })).toMatchObject({
      dateFrom: "2026-11-17", dateTo: "2026-11-18", startTime: customRange.from.toISOString(), endTime: customRange.to.toISOString(),
    });
  });
});
