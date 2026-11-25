import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TeamSchedule from "./page";
import { attendanceApi } from "@/lib/attendance/api";

vi.mock("@/lib/attendance/api", () => ({ attendanceApi: {
  teamSchedule: vi.fn(), listShiftTemplates: vi.fn(), listScheduleAudit: vi.fn(),
  createSchedule: vi.fn(), createWeeklySchedules: vi.fn(),
  rosterDrafts: vi.fn(), saveRosterDraft: vi.fn(), publishRosterDraft: vi.fn(),
} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
  vi.mocked(attendanceApi.listShiftTemplates).mockResolvedValue([
    { id: 1, name: "Breakfast", start_local_time: "07:00", end_local_time: "11:00", unpaid_break_minutes: 0, is_active: true },
    { id: 2, name: "Dinner", start_local_time: "18:00", end_local_time: "22:00", unpaid_break_minutes: 0, is_active: true },
  ] as Awaited<ReturnType<typeof attendanceApi.listShiftTemplates>>);
  vi.mocked(attendanceApi.listScheduleAudit).mockResolvedValue([]);
  vi.mocked(attendanceApi.rosterDrafts).mockResolvedValue([]);
  vi.mocked(attendanceApi.saveRosterDraft).mockResolvedValue({ id: 1 });
  vi.mocked(attendanceApi.teamSchedule).mockResolvedValue([{ staff_id: 7, staff_name: "Test staff", multiple_shifts_supported: true, days: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-11-${23 + index}`, kind: "shift", label: "Breakfast + Dinner", detail: "07:00–11:00 · 18:00–22:00",
    shifts: [{ shift_template_id: 1, label: "Breakfast", detail: "07:00–11:00", scheduled_start_at: "2026-11-23T07:00:00Z", scheduled_end_at: "2026-11-23T11:00:00Z" },
      { shift_template_id: 2, label: "Dinner", detail: "18:00–22:00", scheduled_start_at: "2026-11-23T18:00:00Z", scheduled_end_at: "2026-11-23T22:00:00Z" }],
  })) }]);
  vi.mocked(attendanceApi.createSchedule).mockReset().mockResolvedValue({} as Awaited<ReturnType<typeof attendanceApi.createSchedule>>);
  vi.mocked(attendanceApi.createWeeklySchedules).mockReset().mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

it("edits and saves all existing shift slots instead of silently keeping just the first", async () => {
  render(<TeamSchedule />);
  fireEvent.click((await screen.findAllByRole("button", { name: "Edit shifts for 2026-11-23" }))[0]);
  expect(screen.getByRole("dialog")).toHaveClass("w-[calc(100vw-2rem)]", "grid-cols-[minmax(0,1fr)]", "overflow-x-hidden");
  expect(screen.getByRole("combobox", { name: "2026-11-23, shift 1" })).toHaveTextContent("Breakfast");
  expect(screen.getByRole("combobox", { name: "2026-11-23, shift 2" })).toHaveTextContent("Dinner");
  fireEvent.click(screen.getByRole("button", { name: "Save shifts" }));
  await waitFor(() => expect(attendanceApi.createSchedule).toHaveBeenCalledWith(expect.objectContaining({
    staff_id: 7, weekday: 0, shift_template_id: 1, shift_template_ids: [1, 2], is_day_off: false,
  })));
});

it("keeps the editor and selected shifts when the backend rejects overlapping hours", async () => {
  vi.mocked(attendanceApi.createSchedule).mockRejectedValue(new Error("Dinner overlaps the next shift. Change its hours."));
  render(<TeamSchedule />);
  fireEvent.click((await screen.findAllByRole("button", { name: "Edit shifts for 2026-11-23" }))[0]);
  fireEvent.click(screen.getByRole("button", { name: "Save shifts" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Dinner overlaps the next shift");
  expect(screen.getByRole("combobox", { name: "2026-11-23, shift 2" })).toHaveTextContent("Dinner");
});

it("submits multiple slots in a weekly assignment and explicit empty day-off lists", async () => {
  render(<TeamSchedule />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Add shift for Monday" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Add shift for Monday" }));
  fireEvent.click(screen.getByRole("button", { name: "Add shift for Monday" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "Select Test staff" }));
  fireEvent.click(screen.getByRole("button", { name: "Save roster draft" }));
  await waitFor(() => expect(attendanceApi.saveRosterDraft).toHaveBeenCalledWith(expect.objectContaining({
    staff_ids: [7], assignments: [
      { weekday: 0, shift_template_id: 1, shift_template_ids: [1, 2], is_day_off: false },
      ...Array.from({ length: 6 }, (_, index) => ({ weekday: index + 1, shift_template_id: null, shift_template_ids: [], is_day_off: true })),
    ],
  })));
});

it("does not send additional shifts to an older server that would silently discard them", async () => {
  const rows = await attendanceApi.teamSchedule("2026-11-23");
  vi.mocked(attendanceApi.teamSchedule).mockResolvedValue(rows.map(row => ({ ...row, multiple_shifts_supported: false })));
  render(<TeamSchedule />);
  expect(await screen.findByText(/Update the backend before assigning additional shifts/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add shift for Monday" }));
  expect(screen.getByRole("button", { name: "Add shift for Monday" })).toBeDisabled();
});
