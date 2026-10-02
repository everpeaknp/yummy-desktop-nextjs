import { describe, expect, it } from "vitest";
import { hasPermission, isRouteAllowed } from "@/lib/role-permissions";

describe("hotel PMS permissions", () => {
  it("treats hotel.manage as the client compatibility umbrella", () => {
    const user = {
      role: "user",
      roles: ["Front Desk Lead"],
      permissions: ["hotel.manage"],
      restaurant_id: 4,
    };

    expect(hasPermission(user, "hotel.view")).toBe(true);
    expect(hasPermission(user, "hotel.bookings.manage")).toBe(true);
    expect(hasPermission(user, "hotel.night_audit.run")).toBe(true);
    expect(isRouteAllowed("/hotel", user)).toBe(true);
  });

  it("allows housekeeping managers to view the board without granting unrelated hotel actions", () => {
    const user = {
      role: "user",
      roles: ["Housekeeping Supervisor"],
      permissions: ["hotel.housekeeping.manage"],
      restaurant_id: 4,
    };

    expect(hasPermission(user, "hotel.housekeeping.view")).toBe(true);
    expect(hasPermission(user, "hotel.checkout")).toBe(false);
  });
});
