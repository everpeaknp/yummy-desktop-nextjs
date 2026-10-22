import { describe, expect, it } from "vitest";
import { kitchenStationOptions } from "./kitchen-station-access";
const user = (permissions: string[]) => ({ role: "user", permissions });
describe("kitchen station options", () => {
  it("isolates kitchen", () => expect(kitchenStationOptions(user(["station.kitchen.view"]))).toEqual(["Kitchen"]));
  it("isolates bar", () => expect(kitchenStationOptions(user(["station.bar.view"]))).toEqual(["Bar"]));
  it("isolates cafe", () => expect(kitchenStationOptions(user(["station.cafe.view"]))).toEqual(["Cafe"]));
  it("combines only granted stations", () => expect(kitchenStationOptions(user(["station.kitchen.view", "station.bar.view"]))).toEqual(["All", "Kitchen", "Bar"]));
  it("denies empty grants", () => expect(kitchenStationOptions(user([]))).toEqual([]));
  it("does not expose custom stations to a single-station user", () => expect(kitchenStationOptions(user(["station.bar.view"]), ["Private"])).toEqual(["Bar"]));
});
