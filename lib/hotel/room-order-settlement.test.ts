import { describe, expect, it } from "vitest";
import { canPostRoomOrderToFolio, requiresRoomOrderKotFulfillment } from "./room-order-settlement";

describe("room order folio KOT gate", () => {
  it("does not block posting when restaurant KOT is disabled", () => {
    expect(canPostRoomOrderToFolio({ kotEnabled: false, kotEntitled: true, allKotsServed: false })).toBe(true);
  });

  it("does not block posting when the plan has no digital KOT entitlement", () => {
    expect(canPostRoomOrderToFolio({ kotEnabled: true, kotEntitled: false, allKotsServed: false })).toBe(true);
  });

  it("requires served KOTs only when the workflow is enabled and entitled", () => {
    expect(requiresRoomOrderKotFulfillment({ kotEnabled: true, kotEntitled: true })).toBe(true);
    expect(canPostRoomOrderToFolio({ kotEnabled: true, kotEntitled: true, allKotsServed: false })).toBe(false);
    expect(canPostRoomOrderToFolio({ kotEnabled: true, kotEntitled: true, allKotsServed: true })).toBe(true);
  });
});
