import { describe, expect, it } from "vitest";
import {
  currentHousekeepingTasks,
  housekeepingBoardCounts,
  housekeepingHistory,
} from "./housekeeping-board";
import type { HotelHousekeepingTask } from "./types";

function task(
  id: number,
  roomId: number,
  roomNumber: string,
  status: string,
): HotelHousekeepingTask {
  return {
    id,
    room_id: roomId,
    restaurant_id: 1,
    business_date: "2026-08-13",
    task_type: "departure_clean",
    status,
    priority: 10,
    assigned_to: null,
    notes: null,
    room: { id: roomId, number: roomNumber } as HotelHousekeepingTask["room"],
  };
}

describe("housekeeping board", () => {
  it("shows only the latest cleaning cycle for each room on the current board", () => {
    const tasks = [
      task(2, 8, "8", "inspected"),
      task(3, 1, "1", "pending"),
      task(4, 9, "dsa", "inspected"),
      task(5, 2, "2", "pending"),
      task(6, 8, "8", "pending"),
    ];

    expect(currentHousekeepingTasks(tasks).map((item) => item.id)).toEqual([3, 5, 6, 4]);
    expect(housekeepingBoardCounts(tasks)).toEqual({
      pending: 3,
      cleaning: 0,
      awaitingInspection: 0,
      ready: 1,
    });
  });

  it("keeps inspected and canceled cycles in history", () => {
    const tasks = [
      task(2, 8, "8", "inspected"),
      task(6, 8, "8", "pending"),
      task(7, 2, "2", "canceled"),
    ];

    expect(housekeepingHistory(tasks).map((item) => item.id)).toEqual([7, 2]);
  });
});
