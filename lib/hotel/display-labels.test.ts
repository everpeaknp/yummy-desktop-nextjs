import { describe, expect, it } from "vitest";
import { humanizeHotelStatus, roomServiceStatusLabel } from "./display-labels";

describe("hotel display language", () => {
  it("hides internal hotel state names", () => {
    expect(humanizeHotelStatus("settlement_pending")).toBe("Payment needed");
    expect(humanizeHotelStatus("no_show")).toBe("Did not arrive");
    expect(humanizeHotelStatus("room_revenue_posted")).toBe("Room charges added");
  });

  it("describes room service in operational language", () => {
    expect(
      roomServiceStatusLabel({ status: "completed", settlementStatus: "posted_to_folio" }),
    ).toBe("Included in guest bill");
    expect(
      roomServiceStatusLabel({ status: "ready", settlementStatus: "unsettled" }),
    ).toBe("Ready for delivery");
  });
});
