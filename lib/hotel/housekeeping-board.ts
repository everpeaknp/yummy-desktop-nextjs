import type { HotelHousekeepingTask } from "./types";

export interface HousekeepingBoardCounts {
  pending: number;
  cleaning: number;
  awaitingInspection: number;
  ready: number;
}

export function currentHousekeepingTasks(
  tasks: HotelHousekeepingTask[],
): HotelHousekeepingTask[] {
  const currentByRoom = new Map<number, HotelHousekeepingTask>();

  for (const task of tasks) {
    if (task.status === "canceled") continue;
    const current = currentByRoom.get(task.room_id);
    if (!current || task.id > current.id) currentByRoom.set(task.room_id, task);
  }

  return Array.from(currentByRoom.values()).sort(
    (left, right) =>
      right.priority - left.priority ||
      left.room.number.localeCompare(right.room.number, undefined, { numeric: true }),
  );
}

export function housekeepingHistory(
  tasks: HotelHousekeepingTask[],
): HotelHousekeepingTask[] {
  return tasks
    .filter((task) => ["inspected", "canceled"].includes(task.status))
    .sort((left, right) => right.id - left.id);
}

export function housekeepingBoardCounts(
  tasks: HotelHousekeepingTask[],
): HousekeepingBoardCounts {
  const current = currentHousekeepingTasks(tasks);
  return {
    pending: current.filter((task) => ["pending", "assigned"].includes(task.status)).length,
    cleaning: current.filter((task) => task.status === "in_progress").length,
    awaitingInspection: current.filter((task) => task.status === "completed").length,
    ready: current.filter((task) => task.status === "inspected").length,
  };
}
