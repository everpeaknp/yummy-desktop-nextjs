import { describe, expect, it } from "vitest";
import { buildHotelBookingRooms, newHotelRoomDraft } from "./booking-draft";
import type { HotelAvailability } from "./types";

const availability = {
  arrival_date: "2026-08-14",
  departure_date: "2026-08-15",
  nights: 1,
  room_types: [
    {
      room_type: { id: 1, name: "Deluxe", max_adults: 2, max_children: 1 },
      available_inventory: 2,
    },
  ],
} as HotelAvailability;

describe("multi-room booking draft", () => {
  it("builds several rooms and maps the primary guest to the first room", () => {
    const first = {
      ...newHotelRoomDraft("a", "1"),
      assignedRoomId: "11",
      adults: "2",
      children: "1",
      occupantNames: ["Bikash Rai", "Nima Rai"],
    };
    const second = {
      ...newHotelRoomDraft("b", "1"),
      assignedRoomId: "12",
      occupantNames: ["Kiran Rai"],
    };

    const rooms = buildHotelBookingRooms([first, second], availability, {
      name: "Asha Rai",
      phone: "9800000000",
    });

    expect(rooms).toHaveLength(2);
    expect(rooms[0].guests?.[0]).toMatchObject({ name: "Asha Rai", is_primary: true });
    expect(rooms[0].guests?.[2]).toMatchObject({ name: "Nima Rai", guest_type: "child" });
    expect(rooms[1].guests?.[0]).toMatchObject({ name: "Kiran Rai", is_primary: false });
  });

  it("rejects duplicate physical rooms", () => {
    const first = { ...newHotelRoomDraft("a", "1"), assignedRoomId: "11" };
    const second = { ...newHotelRoomDraft("b", "1"), assignedRoomId: "11" };

    expect(() =>
      buildHotelBookingRooms([first, second], availability, { name: "Asha Rai" }),
    ).toThrow("only be selected once");
  });

  it("rejects room-type quantities above live availability", () => {
    const drafts = ["a", "b", "c"].map((key) => newHotelRoomDraft(key, "1"));

    expect(() => buildHotelBookingRooms(drafts, availability, { name: "Asha Rai" })).toThrow(
      "Only 2 Deluxe",
    );
  });
});
