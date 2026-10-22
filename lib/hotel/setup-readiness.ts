import type { HotelFloor, HotelPropertySettings, HotelRatePlan, HotelRoom, HotelRoomType } from "./types";

export interface HotelSetupInput {
  settings: HotelPropertySettings | null;
  roomTypes: HotelRoomType[];
  rooms: HotelRoom[];
  floors: HotelFloor[];
  ratePlans: HotelRatePlan[];
}
export type HotelSetupStepStatus = "ready" | "needs_attention" | "optional" | "unknown";
export type HotelSetupStepKey = "settings" | "floors" | "roomTypes" | "rooms" | "rates" | "ratePlans";
export interface HotelSetupStep { status: HotelSetupStepStatus; reason: string }
export interface HotelSetupReadiness {
  operationalReady: boolean;
  steps: Record<HotelSetupStepKey, HotelSetupStep>;
}

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(value);

export function buildHotelSetupReadiness(input: HotelSetupInput): HotelSetupReadiness {
  const { settings, roomTypes, rooms, floors, ratePlans } = input;
  const activeTypes = roomTypes.filter((type) => type.is_active);
  const activeTypeIds = new Set(activeTypes.map((type) => type.id));
  const assignedRooms = rooms.filter((room) => room.is_active && activeTypeIds.has(room.room_type_id));
  const pricedTypeIds = new Set(activeTypes.filter((type) => {
    const rate = Number(type.base_rate);
    return Number.isFinite(rate) && rate > 0;
  }).map((type) => type.id));
  const hasPricedRoom = assignedRooms.some((room) => pricedTypeIds.has(room.room_type_id));
  const settingsReady = !!settings && validTime(settings.default_checkin_time)
    && validTime(settings.default_checkout_time) && !!settings.currency.trim()
    && typeof settings.allow_overbooking === "boolean"
    && typeof settings.require_clean_room_for_checkin === "boolean";
  return {
    operationalReady: settingsReady && hasPricedRoom,
    steps: {
      settings: { status: !settings ? "unknown" : settingsReady ? "ready" : "needs_attention", reason: !settings ? "Hotel settings are unavailable." : settingsReady ? "Default Hotel settings are configured. Review them for your property." : "Review check-in, checkout, currency, and room policies." },
      floors: { status: floors.some((floor) => floor.is_active) ? "ready" : "optional", reason: "Buildings and floors are optional; rooms can be assigned without a floor." },
      roomTypes: { status: activeTypes.length ? "ready" : "needs_attention", reason: activeTypes.length ? "An active room type is configured." : "Add an active room type before assigning rooms." },
      rooms: { status: assignedRooms.length ? "ready" : "needs_attention", reason: assignedRooms.length ? "An active room is linked to an active room type." : "Add an active room and link it to an active room type." },
      rates: { status: hasPricedRoom ? "ready" : "needs_attention", reason: hasPricedRoom ? "An active room has a positive default booking rate." : "Set a positive base rate for an active room's type. A zero base rate prices availability at zero." },
      ratePlans: { status: ratePlans.some((plan) => plan.is_active) ? "ready" : "optional", reason: "Advanced rate plans and date-specific rates are optional. Stay-date coverage has not been verified." },
    },
  };
}
