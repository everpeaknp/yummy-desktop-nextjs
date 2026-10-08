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
function renderExpanded(ui: Parameters<typeof render>[0]) {
  const view = render(ui);
  fireEvent.click(screen.getByRole("button", { name: "Open setup checklist" }));
  return view;
}
afterEach(cleanup);
describe("HotelSetupChecklist", () => {
  it("shows loading without falsely reporting missing inventory", () => {
    renderExpanded(<HotelSetupChecklist {...props({ status: "loading", readiness: null })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking your hotel setup");
    expect(screen.queryByText(/Add an active room/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set base rates" })).not.toBeInTheDocument();
  });
  it("shows reasons, optional steps and the zero base rate warning", () => {
    renderExpanded(<HotelSetupChecklist {...props()} />);
    expect(screen.getByRole("heading", { name: "Get your hotel ready" })).toBeInTheDocument();
    expect(screen.getByText(incomplete.steps.rates.reason)).toBeInTheDocument();
    expect(screen.getAllByText("Optional")).toHaveLength(2);
    expect(screen.getByText(incomplete.steps.settings.reason)).toBeInTheDocument();
  });
  it("routes each action through its supplied callback", () => {
    const p = props({ hotelTeam: [{ id: 1, name: "Front desk", permissions: ["hotel.view"] }] }); renderExpanded(<HotelSetupChecklist {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Add room types" }));
    fireEvent.click(screen.getByRole("button", { name: "Set base rates" }));
    fireEvent.click(screen.getByRole("button", { name: "Review advanced rates" }));
    fireEvent.click(screen.getByRole("button", { name: "Review Hotel team" }));
    expect(p.onOpenSettings).toHaveBeenCalledOnce();
    expect(p.onOpenInventory).toHaveBeenCalledTimes(2);
    expect(p.onOpenRates).toHaveBeenCalledOnce();
    expect(p.onOpenStaff).toHaveBeenCalledOnce();
  });
  it("collapses and reopens accessibly", () => {
    render(<HotelSetupChecklist {...props()} />);
    const open = screen.getByRole("button", { name: "Open setup checklist" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(incomplete.steps.rates.reason)).not.toBeInTheDocument();
    fireEvent.click(open);
    const collapse = screen.getByRole("button", { name: "Collapse setup checklist" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(collapse);
    expect(screen.queryByText(incomplete.steps.rates.reason)).not.toBeInTheDocument();
    const reopen = screen.getByRole("button", { name: "Open setup checklist" });
    expect(reopen).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(reopen);
    expect(screen.getByText(incomplete.steps.rates.reason)).toBeInTheDocument();
  });
  it("starts ready hotels compact and lets them review optional setup", () => {
    render(<HotelSetupChecklist {...props({ readiness: ready })} />);
    expect(screen.getByText("Your hotel is ready for bookings.")).toBeInTheDocument();
    expect(screen.queryByText(incomplete.steps.floors.reason)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open setup checklist" }));
    expect(screen.getByText(incomplete.steps.floors.reason)).toBeInTheDocument();
  });
  it("switches to compact ready state when required checks pass", () => {
    const p = props(); const view = renderExpanded(<HotelSetupChecklist {...p} />);
    view.rerender(<HotelSetupChecklist {...p} readiness={ready} />);
    expect(screen.queryByText(incomplete.steps.rates.reason)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open setup checklist" })).toBeInTheDocument();
  });
  it("shows informational team members from effective Hotel grants, without inferring access from roles", () => {
    renderExpanded(<HotelSetupChecklist {...props({ hotelTeam: [{ id: 2, name: "Custom front desk", roles: ["custom"], permissions: ["hotel.checkin"] }] })} />);
    expect(within(screen.getByRole("list", { name: "Hotel team" })).getByText("Custom front desk")).toBeInTheDocument();
    expect(screen.queryByText(/required.*team/i)).not.toBeInTheDocument();
  });
  it("shows assigned role and available business scope with effective Hotel access groups", () => {
    renderExpanded(<HotelSetupChecklist {...props({ hotelTeam: [{
      id: 2,
      name: "Custom front desk",
      primary_role: "Front Desk Lead",
      roles: ["Front Desk Lead"],
      business_scope: "hotel",
      permissions: ["hotel.view", "hotel.bookings.manage", "hotel.checkin", "hotel.inventory.manage", "hotel.rates.manage", "hotel.housekeeping.view", "hotel.folio.view", "hotel.night_audit.run"],
    }] })} />);

    const team = screen.getByRole("list", { name: "Hotel team" });
    expect(within(team).getByText("Custom front desk")).toBeInTheDocument();
    expect(within(team).getByText("Role: Front Desk Lead")).toBeInTheDocument();
    expect(within(team).getByText("Hotel scope")).toBeInTheDocument();
    for (const group of ["Hotel view", "Front desk", "Inventory", "Rates", "Housekeeping", "Folio & finance", "Night audit"]) {
      expect(within(team).getByText(group)).toBeInTheDocument();
    }
  });

  it("warns when Hotel viewers or front-desk permission holders are missing", () => {
    renderExpanded(<HotelSetupChecklist {...props({ hotelTeam: [{
      id: 3, name: "Night auditor", roles: ["Night auditor"], permissions: ["hotel.night_audit.run"],
    }] })} />);

    expect(screen.getByText("No team member currently has Hotel viewing access.")).toBeInTheDocument();
    expect(screen.getByText("No one currently appears to have front-desk actions.")).toBeInTheDocument();
    expect(screen.getByText("Night audit")).toBeInTheDocument();
  });

  it("explains an empty Hotel team and offers staff access navigation to managers", () => {
    const p = props({ hotelTeam: [], canManageStaff: true });
    renderExpanded(<HotelSetupChecklist {...p} />);

    expect(screen.getByText("No team members currently have Hotel permissions.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review staff access" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review staff access" }));
    expect(p.onOpenStaff).toHaveBeenCalledOnce();
  });

  it("directs an empty Hotel team to an administrator when staff management is unavailable", () => {
    renderExpanded(<HotelSetupChecklist {...props({ hotelTeam: [], canManageStaff: false })} />);

    expect(screen.getByText("No team members currently have Hotel permissions.")).toBeInTheDocument();
    expect(screen.getByText("Ask an administrator to assign Hotel access to the right staff.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review staff access" })).not.toBeInTheDocument();
  });

  it("hands non-managers to their administrator instead of exposing setup actions", () => {
    renderExpanded(<HotelSetupChecklist {...props({ canManageInventory: false, canManageRates: false, canManageSettings: false, canManageStaff: false })} />);
    expect(screen.getAllByText(/Ask your administrator/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Add room types" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Set base rates" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review Hotel team" })).not.toBeInTheDocument();
  });
  it.each([
    { canManageRates: true, canManageSettings: false, allowed: "Review advanced rates", denied: "Review settings", handoff: "property settings" },
    { canManageRates: false, canManageSettings: true, allowed: "Review settings", denied: "Review advanced rates", handoff: "advanced rates" },
  ])("separates settings and rates affordances: $allowed", ({ canManageRates, canManageSettings, allowed, denied, handoff }) => {
    renderExpanded(<HotelSetupChecklist {...props({ canManageRates, canManageSettings })} />);
    expect(screen.getByRole("button", { name: allowed })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: denied })).not.toBeInTheDocument();
    expect(screen.getByText(`Ask your administrator to review ${handoff}.`)).toBeInTheDocument();
  });
  it("hands off forbidden staff viewing even when staff management is allowed", () => {
    renderExpanded(<HotelSetupChecklist {...props({ teamStatus: "forbidden", hotelTeam: [{ id: 1, name: "Stale person" }] })} />);
    expect(screen.getByText("Ask your administrator to review who has Hotel access.")).toBeInTheDocument();
    expect(screen.queryByText("Stale person")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review Hotel team" })).not.toBeInTheDocument();
  });
  it("retries core errors without rendering stale or false missing states", () => {
    const p = props({ status: "error" }); renderExpanded(<HotelSetupChecklist {...p} />);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't check your hotel setup");
    expect(screen.queryByText(incomplete.steps.rooms.reason)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry setup check" }));
    expect(p.reload).toHaveBeenCalledOnce();
  });
  it("labels unknown settings without a missing-state action", () => {
    const unknown = { ...incomplete, steps: { ...incomplete.steps, settings: { status: "unknown" as const, reason: "Hotel settings are unavailable." } } };
    renderExpanded(<HotelSetupChecklist {...props({ readiness: unknown })} />);
    expect(screen.getByText("Not yet verified")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review settings" })).not.toBeInTheDocument();
  });
  it("keeps a team load failure separate from known Hotel readiness and offers retry", () => {
    const p = props({ teamStatus: "error" }); renderExpanded(<HotelSetupChecklist {...p} />);
    expect(screen.getByText(incomplete.steps.rates.reason)).toBeInTheDocument();
    expect(screen.getByText("We couldn't load the Hotel team.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry team review" }));
    expect(p.reload).toHaveBeenCalledOnce();
    expect(screen.queryByText("No Hotel team members to display yet.")).not.toBeInTheDocument();
  });
});
