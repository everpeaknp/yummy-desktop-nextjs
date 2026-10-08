import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHotelSetupReadiness } from "@/lib/hotel/setup-readiness";
import { HotelSetupChecklist, type HotelSetupChecklistProps } from "./hotel-setup-checklist";

const incomplete = buildHotelSetupReadiness({
  settings: { default_checkin_time: "14:00", default_checkout_time: "11:00", currency: "NPR", allow_overbooking: false, require_clean_room_for_checkin: true } as Parameters<typeof buildHotelSetupReadiness>[0]["settings"],
  floors: [], roomTypes: [], rooms: [], ratePlans: [],
});
const ready = { ...incomplete, operationalReady: true, steps: { ...incomplete.steps, roomTypes: { status: "ready" as const, reason: "An active room type is configured." }, rooms: { status: "ready" as const, reason: "An active room is linked to an active room type." }, rates: { status: "ready" as const, reason: "An active room has a positive default booking rate." } } };
function props(overrides: Partial<HotelSetupChecklistProps> = {}): HotelSetupChecklistProps {
  return { status: "ready", readiness: incomplete, hotelTeam: [], teamStatus: "ready", reload: vi.fn(async () => {}), canManageInventory: true, canManageRates: true, canManageSettings: true, canManageStaff: true, onOpenInventory: vi.fn(), onOpenRates: vi.fn(), onOpenSettings: vi.fn(), onOpenStaff: vi.fn(), ...overrides };
}
const titles = ["Property settings", "Buildings and floors", "Room types", "Rooms", "Default booking rates", "Advanced rates", "Hotel team review"];
function open() { fireEvent.click(screen.getByRole("button", { name: "Open setup checklist" })); }
function goToStep(number: number) {
  if (screen.queryByRole("button", { name: "Open setup checklist" })) open();
  let current = Number(screen.getByRole("progressbar", { name: "Hotel setup progress" }).getAttribute("aria-valuenow"));
  while (current < number) {
    fireEvent.click(screen.getByRole("button", { name: `Continue to ${titles[current]}` }));
    current++;
  }
  while (current > number) {
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    current--;
  }
}
afterEach(cleanup);

describe("HotelSetupChecklist", () => {
  it("starts collapsed by default and reports setup progress after opening", () => {
    render(<HotelSetupChecklist {...props()} />);
    expect(screen.getByRole("button", { name: "Open setup checklist" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "Get your hotel ready" })).not.toBeInTheDocument();
    expect(screen.queryByText("A few checks will help your team welcome guests with confidence.")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Hotel setup progress" })).not.toBeInTheDocument();
    open();
    expect(screen.getByRole("progressbar", { name: "Hotel setup progress" })).toHaveAttribute("aria-valuemax", "7");
    expect(screen.getByText(incomplete.steps.settings.reason)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review settings" })).toBeInTheDocument();
  });

  it("shows loading and core errors without inventing readiness gaps", () => {
    const loading = render(<HotelSetupChecklist {...props({ status: "loading", readiness: null })} />);
    open();
    expect(screen.getByRole("status")).toHaveTextContent("Checking your hotel setup");
    expect(screen.queryByText(/Add an active room/)).not.toBeInTheDocument();
    loading.unmount();

    const p = props({ status: "error", readiness: null });
    render(<HotelSetupChecklist {...p} />);
    open();
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't check your hotel setup");
    fireEvent.click(screen.getByRole("button", { name: "Retry setup check" }));
    expect(p.reload).toHaveBeenCalledOnce();
  });

  it("routes settings, room, base-rate, and advanced-rate actions from their own steps", () => {
    const p = props(); render(<HotelSetupChecklist {...p} />);
    goToStep(1); fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
    goToStep(3); fireEvent.click(screen.getByRole("button", { name: "Add room types" }));
    goToStep(4); fireEvent.click(screen.getByRole("button", { name: "Add rooms" }));
    goToStep(5); fireEvent.click(screen.getByRole("button", { name: "Set base rates" }));
    goToStep(6); fireEvent.click(screen.getByRole("button", { name: "Review advanced rates" }));
    expect(p.onOpenSettings).toHaveBeenCalledOnce();
    expect(p.onOpenInventory).toHaveBeenCalledTimes(3);
    expect(p.onOpenRates).toHaveBeenCalledOnce();
  });

  it("keeps the active step when the panel is collapsed and reopened", () => {
    render(<HotelSetupChecklist {...props()} />); goToStep(3);
    fireEvent.click(screen.getByRole("button", { name: "Collapse setup checklist" }));
    expect(screen.queryByRole("heading", { name: "Room types" })).not.toBeInTheDocument();
    open();
    expect(screen.getByText("Step 3 of 7")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Room types" })).toBeInTheDocument();
  });

  it("closes when clicking outside and restores the same step when reopened", () => {
    render(<HotelSetupChecklist {...props()} />);
    goToStep(3);
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole("button", { name: "Open setup checklist" })).toHaveAttribute("aria-expanded", "false");
    open();
    expect(screen.getByText("Step 3 of 7")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Room types" })).toBeInTheDocument();
  });

  it("keeps ready hotels collapsed and lets them review setup on demand", () => {
    render(<HotelSetupChecklist {...props({ readiness: ready })} />);
    expect(screen.getByRole("button", { name: "Open setup checklist" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Your hotel is ready for bookings.")).not.toBeInTheDocument();
    open();
    expect(screen.getByText("Your hotel is ready for bookings.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Property settings" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Hotel team" })).not.toBeInTheDocument();
  });

  it("shows effective Hotel grants, role, scope, and access gaps on the final step", () => {
    render(<HotelSetupChecklist {...props({ hotelTeam: [{
      id: 2, name: "Custom front desk", primary_role: "Front Desk Lead", roles: ["Front Desk Lead"], business_scope: "hotel",
      permissions: ["hotel.view", "hotel.bookings.manage", "hotel.checkin", "hotel.inventory.manage", "hotel.rates.manage", "hotel.housekeeping.view", "hotel.folio.view", "hotel.night_audit.run"],
    }] })} />);
    goToStep(7);
    const team = screen.getByRole("list", { name: "Hotel team" });
    expect(within(team).getByText("Custom front desk")).toBeInTheDocument();
    expect(within(team).getByText("Role: Front Desk Lead")).toBeInTheDocument();
    expect(within(team).getByText("Hotel scope")).toBeInTheDocument();
    for (const group of ["Hotel view", "Front desk", "Inventory", "Rates", "Housekeeping", "Folio & finance", "Night audit"]) expect(within(team).getByText(group)).toBeInTheDocument();

    cleanup();
    render(<HotelSetupChecklist {...props({ hotelTeam: [{ id: 3, name: "Night auditor", permissions: ["hotel.night_audit.run"] }] })} />);
    goToStep(7);
    expect(screen.getByText("No team member currently has Hotel viewing access.")).toBeInTheDocument();
    expect(screen.getByText("No one currently appears to have front-desk actions.")).toBeInTheDocument();
  });

  it("handles empty, forbidden, and failed team review states without affecting readiness", () => {
    const emptyProps = props({ hotelTeam: [], canManageStaff: true }); render(<HotelSetupChecklist {...emptyProps} />); goToStep(7);
    expect(screen.getByText("No team members currently have Hotel permissions.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review staff access" }));
    expect(emptyProps.onOpenStaff).toHaveBeenCalledOnce();

    cleanup();
    render(<HotelSetupChecklist {...props({ teamStatus: "forbidden", hotelTeam: [{ id: 1, name: "Stale person" }] })} />); goToStep(7);
    expect(screen.getByText("Ask your administrator to review who has Hotel access.")).toBeInTheDocument();
    expect(screen.queryByText("Stale person")).not.toBeInTheDocument();

    cleanup();
    const errorProps = props({ teamStatus: "error" }); render(<HotelSetupChecklist {...errorProps} />); goToStep(7);
    expect(screen.getByText("We couldn't load the Hotel team.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry team review" }));
    expect(errorProps.reload).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Hotel team review" })).toBeInTheDocument();
  });

  it("does not expose actions outside a user's permissions", () => {
    render(<HotelSetupChecklist {...props({ canManageInventory: false, canManageRates: false, canManageSettings: false, canManageStaff: false })} />);
    goToStep(1);
    expect(screen.queryByRole("button", { name: "Review settings" })).not.toBeInTheDocument();
    expect(screen.getByText("Ask your administrator to review property settings.")).toBeInTheDocument();
    goToStep(6);
    expect(screen.queryByRole("button", { name: "Review advanced rates" })).not.toBeInTheDocument();
    expect(screen.getByText("Ask your administrator to review advanced rates.")).toBeInTheDocument();
    goToStep(7);
    expect(screen.queryByRole("button", { name: "Review Hotel team" })).not.toBeInTheDocument();
  });
});
