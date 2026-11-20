import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShiftSlotPicker } from "./shift-slot-picker";
import type { AttendanceShiftTemplate } from "@/lib/attendance/types";

const templates = [
  { id: 1, name: "Breakfast", start_local_time: "07:00:00", end_local_time: "11:00:00", is_active: true },
  { id: 2, name: "Dinner", start_local_time: "18:00:00", end_local_time: "22:00:00", is_active: true },
] as AttendanceShiftTemplate[];

function Editor({ initial = [] }: { initial?: number[] }) {
  const [value, setValue] = useState(initial);
  return <><ShiftSlotPicker label="Monday" templates={templates} value={value} onChange={setValue} />
    <output aria-label="Selected shifts">{JSON.stringify(value)}</output></>;
}

describe("shift slots", () => {
  it("adds independent shifts without replacing the first and can return to day off", () => {
    render(<Editor />);
    expect(screen.getByText("Day off")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add shift for Monday" }));
    fireEvent.click(screen.getByRole("button", { name: "Add shift for Monday" }));
    expect(screen.getByLabelText("Selected shifts")).toHaveTextContent("[1,2]");
    expect(screen.getByRole("combobox", { name: "Monday, shift 1" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Monday, shift 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add shift for Monday" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove Monday, shift 1" }));
    expect(screen.getByLabelText("Selected shifts")).toHaveTextContent("[2]");
    fireEvent.click(screen.getByRole("button", { name: "Remove Monday, shift 1" }));
    expect(screen.getByText("Day off")).toBeInTheDocument();
  });

  it("preserves multiple saved IDs and unavailable templates until explicitly removed", () => {
    render(<Editor initial={[99, 2]} />);
    expect(screen.getByRole("combobox", { name: "Monday, shift 1" })).toHaveTextContent("Shift unavailable");
    expect(screen.getByLabelText("Selected shifts")).toHaveTextContent("[99,2]");
    fireEvent.click(screen.getByRole("button", { name: "Add shift for Monday" }));
    expect(screen.getByLabelText("Selected shifts")).toHaveTextContent("[99,2,1]");
  });

  it("allows long shift names to wrap without displacing the remove control", () => {
    const name = "ATTENDANCE_QA:qa-attendance-20261019:Day shift";
    render(<ShiftSlotPicker label="Friday" templates={[{ ...templates[0], name }]} value={[1]} onChange={() => {}} />);
    const select = screen.getByRole("combobox", { name: "Friday, shift 1" });
    expect(select).toHaveTextContent(`${name} · 07:00–11:00`);
    expect(select).toHaveClass("min-w-0", "h-auto", "[&>span]:whitespace-normal", "[&>span]:[overflow-wrap:anywhere]");
    expect(select.parentElement).toHaveClass("grid-cols-[minmax(0,1fr)_auto]");
    expect(screen.getByRole("button", { name: "Remove Friday, shift 1" })).toHaveClass("h-11", "w-11");
  });
});
