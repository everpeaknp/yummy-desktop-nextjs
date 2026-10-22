import { describe, expect, it } from "vitest";

import { getMobileRoutePresentation } from "./mobile-module-navigation";

describe("Grow mobile route labels", () => {
  it.each([
    ["/grow", "Grow"],
    ["/grow/campaigns", "Campaigns"],
    ["/grow/campaigns/new", "Create campaign"],
    ["/grow/subscribers", "Customers"],
    ["/grow/settings", "Grow settings"],
  ])("uses the shared %s title", (path, title) => {
    expect(getMobileRoutePresentation(path).title).toBe(title);
  });
});
