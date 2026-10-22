import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "@/components/ui/tabs";
import { AttendanceMobileNavigation } from "./attendance-mobile-navigation";

describe("attendance mobile navigation", () => {
  it("exposes daily destinations as tabs instead of a filter", () => {
    const change = vi.fn();
    render(<Tabs defaultValue="overview" onValueChange={change}><AttendanceMobileNavigation activeTab="overview" onChange={change} canViewAttendance canPayrollExport canManageAttendance canManageDevices /></Tabs>);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Daily attendance", "Reports", "Timesheets", "Payroll", "Schedule", "Leave & holidays"]);
    expect(screen.getByRole("tab", { name: "Daily attendance" })).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Reports" }), { button: 0, ctrlKey: false });
    expect(change).toHaveBeenCalledWith("reports");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("does not expose destinations without permission", () => {
    render(<Tabs defaultValue="overview"><AttendanceMobileNavigation activeTab="overview" onChange={vi.fn()} canViewAttendance canPayrollExport={false} canManageAttendance={false} canManageDevices={false} /></Tabs>);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Attendance setup" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Payroll" })).not.toBeInTheDocument();
  });

  it("names the selected setup destination", () => {
    render(<Tabs defaultValue="devices"><AttendanceMobileNavigation activeTab="devices" onChange={vi.fn()} canViewAttendance={false} canPayrollExport={false} canManageAttendance={false} canManageDevices /></Tabs>);
    expect(screen.getByRole("button", { name: "Setup: Devices" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });
});
