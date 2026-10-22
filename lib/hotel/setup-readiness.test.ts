import { describe, expect, it } from "vitest";
import { buildHotelSetupReadiness, type HotelSetupInput } from "./setup-readiness";
import type { HotelPropertySettings, HotelRoom, HotelRoomType } from "./types";

const settings: HotelPropertySettings = { id: 1, restaurant_id: 52, default_checkin_time: "14:00:00", default_checkout_time: "11:00:00", currency: "NPR", allow_overbooking: false, require_clean_room_for_checkin: true, current_business_date: "2026-10-06", version: 1 };
const roomType: HotelRoomType = { id: 1, restaurant_id: 52, code: "STD", name: "Standard", description: null, base_occupancy: 2, max_adults: 2, max_children: 0, base_rate: "100.00", amenities: [], is_active: true };
const room: HotelRoom = { id: 1, restaurant_id: 52, room_type_id: 1, floor_id: null, number: "101", name: null, capacity: 2, occupancy_status: "vacant", housekeeping_status: "clean", service_status: "in_service", notes: null, pos_x: 0, pos_y: 0, layout_width: 1, layout_height: 1, door_side: "top", door_offset: 0, is_active: true, version: 1, room_type: roomType, floor: null };
const input = (patch: Partial<HotelSetupInput> = {}): HotelSetupInput => ({ settings, roomTypes: [roomType], rooms: [room], floors: [], ratePlans: [], ...patch });

describe("Hotel setup readiness", () => {
  it("requires an active room type", () => {
    const result = buildHotelSetupReadiness(input({ roomTypes: [] }));
    expect(result.steps.roomTypes.status).toBe("needs_attention");
    expect(result.operationalReady).toBe(false);
  });
  it("requires an active room", () => {
    for (const rooms of [[], [{ ...room, is_active: false }]]) {
      expect(buildHotelSetupReadiness(input({ rooms })).steps.rooms.status).toBe("needs_attention");
      expect(buildHotelSetupReadiness(input({ rooms })).operationalReady).toBe(false);
    }
  });
  it("rejects a room linked to an inactive or missing type", () => {
    for (const roomTypes of [[{ ...roomType, is_active: false }], [{ ...roomType, id: 2 }]]) {
      const result = buildHotelSetupReadiness(input({ roomTypes }));
      expect(result.steps.rooms.status).toBe("needs_attention");
      expect(result.operationalReady).toBe(false);
    }
  });
  it.each([0, "0.00", -1, "invalid", "", Infinity, NaN])("flags unusable base rate %s", (base_rate) => {
    const result = buildHotelSetupReadiness(input({ roomTypes: [{ ...roomType, base_rate }] }));
    expect(result.steps.rates.status).toBe("needs_attention");
    expect(result.operationalReady).toBe(false);
  });
  it.each([100, "100.50"])("accepts positive base rate %s", (base_rate) => {
    expect(buildHotelSetupReadiness(input({ roomTypes: [{ ...roomType, base_rate }] })).operationalReady).toBe(true);
  });
  it("requires the active room to link to the positively priced type", () => {
    const result = buildHotelSetupReadiness(input({ roomTypes: [{ ...roomType, base_rate: 0 }, { ...roomType, id: 2, base_rate: 100 }] }));
    expect(result.operationalReady).toBe(false);
    expect(result.steps.rates.status).toBe("needs_attention");
  });
  it("accepts default settings with no floors or advanced rate plans", () => {
    const result = buildHotelSetupReadiness(input());
    expect(result.operationalReady).toBe(true);
    expect(result.steps.settings.status).toBe("ready");
    expect(result.steps.floors.status).toBe("optional");
    expect(result.steps.ratePlans.status).toBe("optional");
  });
  it("reports unavailable settings as unknown", () => {
    const result = buildHotelSetupReadiness(input({ settings: null }));
    expect(result.steps.settings.status).toBe("unknown");
    expect(result.operationalReady).toBe(false);
  });
  it("flags invalid settings", () => {
    for (const patch of [{ currency: "" }, { default_checkin_time: "25:00" }, { default_checkout_time: "bad" }]) {
      const result = buildHotelSetupReadiness(input({ settings: { ...settings, ...patch } }));
      expect(result.steps.settings.status).toBe("needs_attention");
      expect(result.operationalReady).toBe(false);
    }
  });
});
