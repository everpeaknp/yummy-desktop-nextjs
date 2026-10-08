import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHotelSetupReadiness } from "@/lib/hotel/setup-readiness";
import { HotelSetupChecklist, type HotelSetupChecklistProps } from "./hotel-setup-checklist";

const readiness = buildHotelSetupReadiness({
  settings: { default_checkin_time: "14:00", default_checkout_time: "11:00", currency: "NPR", allow_overbooking: false, require_clean_room_for_checkin: true } as Parameters<typeof buildHotelSetupReadiness>[0]["settings"],
  floors: [], roomTypes: [], rooms: [], ratePlans: [],
});

function renderChecklist(overrides: Partial<HotelSetupChecklistProps> = {}) {
  const props: HotelSetupChecklistProps = {
    status: "ready", readiness, hotelTeam: [], teamStatus: "ready", reload: vi.fn(async () => {}),
    canManageInventory: true, canManageRates: true, canManageSettings: true, canManageStaff: true,
    onOpenInventory: vi.fn(), onOpenRates: vi.fn(), onOpenSettings: vi.fn(), onOpenStaff: vi.fn(), ...overrides,
  };
  const view = render(<HotelSetupChecklist {...props} />);
  return { props, view };
}

function openChecklist() {
  fireEvent.click(screen.getByRole("button", { name: "Open setup checklist" }));
}

afterEach(cleanup);

describe("Hotel setup wizard", () => {
  it("starts collapsed and opens on the first of seven steps", () => {
    renderChecklist();
    expect(screen.getByRole("button", { name: "Open setup checklist" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Property settings")).not.toBeInTheDocument();

    openChecklist();

    expect(screen.getByRole("progressbar", { name: "Hotel setup progress" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText("Step 1 of 7")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Property settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to Buildings and floors" })).toBeInTheDocument();
  });

  it("supports next, back, and skipping optional steps without blocking entry", () => {
    renderChecklist();
    openChecklist();
    fireEvent.click(screen.getByRole("button", { name: "Continue to Buildings and floors" }));
    expect(screen.getByText("Step 2 of 7")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Buildings and floors" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip this optional step" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip this optional step" }));
    expect(screen.getByText("Step 3 of 7")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Room types" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 2 of 7")).toBeInTheDocument();
  });

  it("keeps the relevant action on its step and only shows the Hotel team on the final step", () => {
    const onOpenInventory = vi.fn();
    renderChecklist({ onOpenInventory, hotelTeam: [{ id: 1, name: "Front desk", permissions: ["hotel.view"] }] });
    openChecklist();
    for (const next of ["Buildings and floors", "Room types", "Rooms"]) {
      fireEvent.click(screen.getByRole("button", { name: `Continue to ${next}` }));
    }
    expect(screen.getByRole("heading", { name: "Rooms" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add rooms" }));
    expect(onOpenInventory).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Open setup checklist" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("list", { name: "Hotel team" })).not.toBeInTheDocument();

    openChecklist();
    for (const next of ["Default booking rates", "Advanced rates"]) {
      fireEvent.click(screen.getByRole("button", { name: `Continue to ${next}` }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Skip this optional step" }));
    expect(screen.getByText("Step 7 of 7")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Hotel team review" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Hotel team" })).toHaveTextContent("Front desk");
  });

  it("finishes without blocking the workspace and stays collapsed", () => {
    renderChecklist();
    openChecklist();
    for (const next of ["Buildings and floors", "Room types", "Rooms", "Default booking rates", "Advanced rates"]) {
      fireEvent.click(screen.getByRole("button", { name: `Continue to ${next}` }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Skip this optional step" }));
    fireEvent.click(screen.getByRole("button", { name: "Done for now" }));
    expect(screen.getByRole("button", { name: "Open setup checklist" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("A few checks will help your team welcome guests with confidence.")).not.toBeInTheDocument();
  });
});
