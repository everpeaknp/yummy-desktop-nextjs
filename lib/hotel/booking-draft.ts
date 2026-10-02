import type { HotelAvailability, HotelBookingCreateInput } from "./types";

export const UNASSIGNED_HOTEL_ROOM = "unassigned";

export interface HotelRoomBookingDraft {
  key: string;
  roomTypeId: string;
  ratePlanId: string;
  assignedRoomId: string;
  adults: string;
  children: string;
  occupantNames: string[];
}

export function newHotelRoomDraft(
  key: string,
  roomTypeId = "",
  ratePlanId = "",
  assignedRoomId = UNASSIGNED_HOTEL_ROOM,
): HotelRoomBookingDraft {
  return {
    key,
    roomTypeId,
    ratePlanId,
    assignedRoomId,
    adults: "1",
    children: "0",
    occupantNames: [],
  };
}

export function roomTypeSelectionCount(
  drafts: HotelRoomBookingDraft[],
  roomTypeId: string,
  exceptKey?: string,
): number {
  return drafts.filter(
    (draft) => draft.key !== exceptKey && draft.roomTypeId === roomTypeId,
  ).length;
}

export function buildHotelBookingRooms(
  drafts: HotelRoomBookingDraft[],
  availability: HotelAvailability,
  primaryGuest: { name: string; phone?: string | null; email?: string | null },
): HotelBookingCreateInput["rooms"] {
  if (!drafts.length) throw new Error("Add at least one room.");
  const assigned = drafts
    .map((draft) => draft.assignedRoomId)
    .filter((roomId) => roomId !== UNASSIGNED_HOTEL_ROOM);
  if (new Set(assigned).size !== assigned.length) {
    throw new Error("A room can only be selected once.");
  }

  const selectedByType = new Map<string, number>();
  return drafts.map((draft, index) => {
    const row = availability.room_types.find(
      (candidate) => String(candidate.room_type.id) === draft.roomTypeId,
    );
    if (!row) throw new Error(`Select a room type for room ${index + 1}.`);
    const rateOption = row.rate_options.find(
      (candidate) => String(candidate.rate_plan.id) === draft.ratePlanId,
    );
    if (!rateOption) throw new Error(`Select a booking option for room ${index + 1}.`);
    const selected = (selectedByType.get(draft.roomTypeId) ?? 0) + 1;
    selectedByType.set(draft.roomTypeId, selected);
    if (selected > row.available_inventory) {
      throw new Error(`Only ${row.available_inventory} ${row.room_type.name} room(s) are available.`);
    }

    const adults = Math.max(1, Number(draft.adults || 1));
    const children = Math.max(0, Number(draft.children || 0));
    if (adults > row.room_type.max_adults || children > row.room_type.max_children) {
      throw new Error(`Room ${index + 1} exceeds ${row.room_type.name} occupancy limits.`);
    }
    const namedOccupants = draft.occupantNames.map((name) => name.trim()).filter(Boolean);
    const primaryAdultSlots = index === 0 ? 1 : 0;
    const guests: NonNullable<HotelBookingCreateInput["rooms"][number]["guests"]> =
      namedOccupants.map((name, occupantIndex) => ({
        name,
        guest_type: occupantIndex < adults - primaryAdultSlots ? "adult" : "child",
        is_primary: false,
      }));
    if (index === 0) {
      guests.unshift({
        name: primaryGuest.name.trim(),
        phone: primaryGuest.phone || null,
        email: primaryGuest.email || null,
        guest_type: "adult",
        is_primary: true,
      });
    }
    if (guests.length > adults + children) {
      throw new Error(`Room ${index + 1} has more named occupants than its occupancy.`);
    }

    return {
      room_type_id: row.room_type.id,
      rate_plan_id: rateOption.rate_plan.id,
      assigned_room_id:
        draft.assignedRoomId === UNASSIGNED_HOTEL_ROOM
          ? null
          : Number(draft.assignedRoomId),
      adults,
      children,
      guests,
    };
  });
}
