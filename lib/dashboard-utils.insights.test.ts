import { describe, expect, it } from "vitest";

import { mergeDashboardInsights } from "@/lib/dashboard-utils";

describe("dashboard insight sources", () => {
  it("labels deterministic analytics and quick insights as operational", () => {
    const insights = mergeDashboardInsights(
      [{ message: "Orders slowed after 8 PM" }],
      [{ message: "Discount usage increased", source: "analytics_rule" }],
    );

    expect(insights.map((insight) => insight.source)).toEqual([
      "operational",
      "operational",
    ]);
  });

  it("uses AI-assisted only for the explicit backend source", () => {
    const insights = mergeDashboardInsights([], [
      { message: "Try a clearer headline", source: "ai_assisted" },
      { message: "Legacy label", source: "ai" },
    ]);

    expect(insights[0].source).toBe("ai_assisted");
    expect(insights[1].source).toBe("operational");
  });
});
