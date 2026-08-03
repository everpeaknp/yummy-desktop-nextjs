import { describe, expect, it } from "vitest";

import { AnalyticsApis, FinanceApis, IncomeApis } from "./endpoints";

function query(url: string) {
  return new URL(url, "https://example.test").searchParams;
}

describe("AnalyticsApis.dashboard", () => {
  it("represents All Stations by omitting the station parameter", () => {
    const params = query(
      AnalyticsApis.dashboard({
        restaurantId: 7,
        dateFrom: "2026-07-05",
        dateTo: "2026-08-03",
        station: undefined,
      }),
    );

    expect(params.get("restaurant_id")).toBe("7");
    expect(params.has("station")).toBe(false);
  });

  it("serializes an explicit finance station without changing its identity", () => {
    const params = query(
      AnalyticsApis.dashboard({
        restaurantId: 7,
        dateFrom: "2026-07-05",
        dateTo: "2026-08-03",
        station: "general",
      }),
    );

    expect(params.get("station")).toBe("general");
  });

  it("serializes the aggregate business-line scope explicitly", () => {
    const urls = [
      AnalyticsApis.dashboard({ restaurantId: 7, businessLine: "all" }),
      AnalyticsApis.compare({ restaurantId: 7, businessLine: "all" }),
      AnalyticsApis.trends({
        metric: "income",
        restaurantId: 7,
        businessLine: "all",
      }),
      FinanceApis.overview({ restaurantId: 7, businessLine: "all" }),
      FinanceApis.expenses({ restaurantId: 7, businessLine: "all" }),
      IncomeApis.dashboard({
        restaurantId: 7,
        dateFrom: "2026-07-05",
        dateTo: "2026-08-03",
        businessLine: "all",
      }),
    ];

    for (const url of urls) {
      expect(query(url).get("business_line")).toBe("all");
    }
  });

  it("uses an exact window instead of also sending calendar dates", () => {
    const params = query(
      AnalyticsApis.dashboard({
        restaurantId: 7,
        dateFrom: "2026-07-05",
        dateTo: "2026-08-03",
        startTime: "2026-08-02T18:15:00.000Z",
        endTime: "2026-08-03T18:15:00.000Z",
      }),
    );

    expect(params.get("start_time")).toBe("2026-08-02T18:15:00.000Z");
    expect(params.get("end_time")).toBe("2026-08-03T18:15:00.000Z");
    expect(params.has("date_from")).toBe(false);
    expect(params.has("date_to")).toBe(false);
  });
});
