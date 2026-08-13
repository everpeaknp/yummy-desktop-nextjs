import { describe, expect, it } from "vitest";

import {
  resolveCashDrawerBusinessLine,
  safeCashDrawerReturnPath,
} from "./cash-drawer-business-line";

describe("cash drawer business line", () => {
  it("defaults a hotel-only property to hotel drawers", () => {
    expect(
      resolveCashDrawerBusinessLine({
        restaurantEnabled: false,
        hotelEnabled: true,
      }),
    ).toBe("hotel");
  });

  it("honors a hotel deep link for a dual property", () => {
    expect(
      resolveCashDrawerBusinessLine({
        requested: "hotel",
        restaurantEnabled: true,
        hotelEnabled: true,
      }),
    ).toBe("hotel");
  });

  it("does not allow a disabled business line", () => {
    expect(
      resolveCashDrawerBusinessLine({
        requested: "hotel",
        restaurantEnabled: true,
        hotelEnabled: false,
      }),
    ).toBe("restaurant");
  });

  it("only accepts local return paths", () => {
    expect(safeCashDrawerReturnPath("/hotel?stay=8")).toBe("/hotel?stay=8");
    expect(safeCashDrawerReturnPath("https://example.com")).toBeNull();
    expect(safeCashDrawerReturnPath("//example.com")).toBeNull();
    expect(safeCashDrawerReturnPath("/\\example.com")).toBeNull();
  });
});
