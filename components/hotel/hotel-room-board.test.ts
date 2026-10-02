import { describe, expect, it } from "vitest";
import type { HotelRoom } from "@/lib/hotel/types";
import {
  hotelRoomGridCoordinates,
  hotelRoomGridLayout,
} from "./hotel-room-board";

const room = {
  id: 1,
  number: "101",
  pos_x: 100,
  pos_y: 120,
} as HotelRoom;

describe("independent hotel floor layout", () => {
  it("converts grid cells into persisted room coordinates", () => {
    expect(hotelRoomGridCoordinates(3, 2)).toEqual({
      pos_x: 300,
      pos_y: 240,
    });
  });

  it("moves colliding rooms into the next free grid cell", () => {
    const layout = hotelRoomGridLayout([
      room,
      { ...room, id: 2, number: "102" },
    ] as HotelRoom[]);
    expect(layout.get(1)).toEqual({ column: 1, row: 1 });
    expect(layout.get(2)).toEqual({ column: 2, row: 1 });
  });
});
