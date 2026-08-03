import { describe, expect, it } from "vitest";

import {
  financeStationLabel,
  financeStationOptions,
  isFinanceStationAvailable,
  toFinanceAttributionStation,
  toFinanceStationParam,
} from "./finance-station-scope";

describe("finance station scope", () => {
  it("omits All Stations and normalizes explicit station identities", () => {
    expect(toFinanceStationParam(undefined)).toBeUndefined();
    expect(toFinanceStationParam("all")).toBeUndefined();
    expect(toFinanceStationParam(" ALL ")).toBeUndefined();
    expect(toFinanceStationParam(" Kitchen ")).toBe("kitchen");
    expect(toFinanceStationParam("General")).toBe("general");
    expect(toFinanceStationParam("other")).toBe("general");
  });

  it("never writes ambiguous or legacy finance attribution", () => {
    expect(toFinanceAttributionStation(undefined)).toBe("general");
    expect(toFinanceAttributionStation("all")).toBe("general");
    expect(toFinanceAttributionStation("other")).toBe("general");
    expect(toFinanceAttributionStation(" Kitchen ")).toBe("kitchen");
  });

  it("includes the explicit General / Shared scope", () => {
    expect(financeStationOptions()).toContainEqual({
      value: "general",
      label: "General / Shared",
    });
    expect(financeStationLabel("general")).toBe("General / Shared");
  });

  it("only offers the hotel station when hotel operations are enabled", () => {
    expect(financeStationOptions().map((option) => option.value)).not.toContain(
      "rooms",
    );
    expect(
      financeStationOptions({ hotelEnabled: true }).map(
        (option) => option.value,
      ),
    ).toContain("rooms");
  });

  it("scopes stations to the selected business line", () => {
    expect(
      financeStationOptions({
        businessLine: "restaurant",
        hotelEnabled: true,
      }).map((option) => option.value),
    ).toEqual(["all", "general", "kitchen", "bar", "cafe"]);
    expect(
      financeStationOptions({ businessLine: "hotel" }).map(
        (option) => option.value,
      ),
    ).toEqual(["all", "general", "rooms"]);
    expect(
      financeStationOptions({
        businessLine: "all",
        hotelEnabled: true,
      }).map((option) => option.value),
    ).toEqual(["all", "general", "kitchen", "bar", "cafe", "rooms"]);
  });

  it("drops a station that is invalid for the selected line", () => {
    const restaurantScope = {
      businessLine: "restaurant",
      hotelEnabled: true,
    };
    const hotelScope = { businessLine: "hotel", hotelEnabled: true };

    expect(toFinanceStationParam("rooms", restaurantScope)).toBeUndefined();
    expect(toFinanceStationParam("kitchen", hotelScope)).toBeUndefined();
    expect(toFinanceStationParam("general", hotelScope)).toBe("general");
    expect(isFinanceStationAvailable("rooms", restaurantScope)).toBe(false);
    expect(isFinanceStationAvailable("rooms", hotelScope)).toBe(true);
  });
});
