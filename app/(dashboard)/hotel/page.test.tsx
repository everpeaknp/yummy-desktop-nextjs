import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildHotelSetupReadiness } from "@/lib/hotel/setup-readiness";
import HotelPmsPage from "./page";

const state = vi.hoisted(() => ({
  user: { restaurant_id: 9, permissions: [] as string[] },
  push: vi.fn(), search: new URLSearchParams(), reload: vi.fn(async () => {}),
  status: "ready", teamStatus: "ready", readiness: {} as unknown,
  hotelTeam: [] as Array<{ id: number; name: string; roles?: string[]; role?: string; permissions?: string[] }>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }), useSearchParams: () => state.search }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: (select: (s: unknown) => unknown) => select({ user: state.user }) }));
vi.mock("@/hooks/use-restaurant", () => ({ useRestaurant: (select: (s: unknown) => unknown) => select({ restaurant: { restaurant_enabled: true } }) }));
vi.mock("@/hooks/use-hotel-setup-readiness", () => ({ useHotelSetupReadiness: (_id: number, canViewStaff: boolean) => ({ status: state.status, readiness: state.readiness, hotelTeam: state.hotelTeam, teamStatus: canViewStaff ? state.teamStatus : "forbidden", reload: state.reload }) }));
vi.mock("@/components/hotel/front-desk-panel", () => ({ FrontDeskPanel: () => <div>Current front desk work</div> }));
vi.mock("@/components/hotel/bookings-panel", () => ({ BookingsPanel: () => <div>Bookings work</div> }));
vi.mock("@/components/hotel/inventory-panel", () => ({ InventoryPanel: ({ initialMode = "book", canManage, onChanged }: { initialMode?: string; canManage: boolean; onChanged: () => void }) => <div>Rooms mode: {canManage ? initialMode : "book"}<button onClick={onChanged}>Room saved</button></div> }));
vi.mock("@/components/hotel/booking-detail-dialog", () => ({ BookingDetailDialog: () => null }));
vi.mock("@/components/hotel/finance-panel", () => ({ FinancePanel: () => null }));
vi.mock("@/components/hotel/housekeeping-panel", () => ({ HousekeepingPanel: () => null }));
vi.mock("@/components/hotel/night-audit-panel", () => ({ NightAuditPanel: () => null }));
vi.mock("@/components/hotel/room-order-analytics-panel", () => ({ RoomOrderAnalyticsPanel: () => null }));
vi.mock("@/lib/hotel/api", () => ({ hotelDate: () => "2026-10-06", hotelPmsApi: {
  getSettings: async () => ({ version: 1, default_checkin_time: "14:00", default_checkout_time: "11:00", currency: "NPR", require_clean_room_for_checkin: true, allow_overbooking: false }),
  listRoomTypes: async () => [], listRatePlans: async () => [],
} }));

beforeEach(() => {
  state.push.mockClear(); state.reload.mockClear(); state.search = new URLSearchParams();
  state.user = { restaurant_id: 9, permissions: ["hotel.view", "hotel.inventory.manage", "hotel.rates.manage", "hotel.manage", "admin.staff.view"] };
  state.status = "ready"; state.teamStatus = "ready";
  state.hotelTeam = [{ id: 10, name: "Hotel team member", permissions: ["hotel.view"] }];
  state.readiness = buildHotelSetupReadiness({ settings: { default_checkin_time: "14:00", default_checkout_time: "11:00", currency: "NPR" } as Parameters<typeof buildHotelSetupReadiness>[0]["settings"], roomTypes: [], rooms: [], floors: [], ratePlans: [] });
});
afterEach(cleanup);
function renderHotelPageWithSetupOpen() {
  const view = render(<HotelPmsPage />);
  const open = screen.queryByRole("button", { name: "Open setup checklist" });
  if (open) fireEvent.click(open);
  return view;
}
const setupStepTitles = ["Property settings", "Buildings and floors", "Room types", "Rooms", "Default booking rates", "Advanced rates", "Hotel team review"];
function goToSetupStep(number: number) {
  if (screen.queryByRole("button", { name: "Open setup checklist" })) fireEvent.click(screen.getByRole("button", { name: "Open setup checklist" }));
  let current = Number(screen.getByRole("progressbar", { name: "Hotel setup progress" }).getAttribute("aria-valuenow"));
  while (current < number) {
    fireEvent.click(screen.getByRole("button", { name: `Continue to ${setupStepTitles[current]}` }));
    current++;
  }
  while (current > number) {
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    current--;
  }
}

describe("Hotel workspace setup integration", () => {
  it("starts with the setup checklist collapsed", () => {
    render(<HotelPmsPage />);
    const setupButton = screen.getByRole("button", { name: "Open setup checklist" });
    expect(setupButton).toBeInTheDocument();
    expect(setupButton.closest("header")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Exit hotel" }).compareDocumentPosition(setupButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Setup steps" })).not.toBeInTheDocument();
  });

  it("uses the dashboard scroll region instead of creating a nested scroller", () => {
    const { container } = renderHotelPageWithSetupOpen();
    expect(container.firstElementChild).not.toHaveClass("overflow-y-auto");
  });

  it("keeps the selected work and existing navigation below the checklist", () => {
    renderHotelPageWithSetupOpen();
    const checklist = screen.getByRole("region", { name: "Hotel setup" });
    const work = screen.getByText("Current front desk work");
    expect(checklist.compareDocumentPosition(work) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const name of ["Front desk", "Bookings", "Rooms", "Rates"]) expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Hotel workspace navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit hotel" })).toBeInTheDocument();
  });
  it("positions mobile Hotel navigation above the shared primary navigation", () => {
    renderHotelPageWithSetupOpen();
    expect(screen.getByRole("navigation", { name: "Hotel workspace navigation" })).toHaveClass("bottom-[calc(4.0625rem+max(env(safe-area-inset-bottom),0.5rem))]");
  });
  it("opens Rooms management and refreshes readiness after an edit", async () => {
    renderHotelPageWithSetupOpen();
    goToSetupStep(4);
    fireEvent.click(screen.getByRole("button", { name: "Add rooms" }));
    expect(screen.getByText("Rooms mode: manage")).toBeInTheDocument();
    expect(state.push).toHaveBeenCalledWith("/hotel?section=inventory", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Room saved" }));
    await waitFor(() => expect(state.reload).toHaveBeenCalled());
  });
  it("closes setup and opens Rooms management from the room-type step", () => {
    renderHotelPageWithSetupOpen();
    goToSetupStep(3);
    fireEvent.click(screen.getByRole("button", { name: "Add room types" }));
    expect(screen.getByRole("button", { name: "Open setup checklist" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Rooms mode: manage")).toBeInTheDocument();
    expect(state.push).toHaveBeenCalledWith("/hotel?section=inventory", { scroll: false });
  });
  it("opens existing settings and booking options directly, including repeated setup actions", async () => {
    renderHotelPageWithSetupOpen();
    fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
    await screen.findByRole("heading", { name: "Hotel settings" });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Daily prices" }));
    expect(screen.getByText("Finish room setup first")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open setup checklist" }));
    fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
    await screen.findByRole("heading", { name: "Hotel settings" });
    goToSetupStep(6);
    fireEvent.click(screen.getByRole("button", { name: "Review advanced rates" }));
    await screen.findByText("No booking options yet");
  });
  it("offers only advanced-rate setup to rates managers", async () => {
    state.user.permissions = ["hotel.view", "hotel.rates.manage"];
    renderHotelPageWithSetupOpen();
    expect(screen.queryByRole("button", { name: "Review settings" })).not.toBeInTheDocument();
    expect(screen.getByText("Ask your administrator to review property settings.")).toBeInTheDocument();
    goToSetupStep(6);
    fireEvent.click(screen.getByRole("button", { name: "Review advanced rates" }));
    await screen.findByText("No booking options yet");
  });
  it("preserves advanced-rate access implied by Hotel management", async () => {
    state.user.permissions = ["hotel.view", "hotel.manage"];
    renderHotelPageWithSetupOpen();
    goToSetupStep(6);
    expect(screen.getByRole("button", { name: "Review advanced rates" })).toBeInTheDocument();
    goToSetupStep(1);
    fireEvent.click(screen.getByRole("button", { name: "Review settings" }));
    await screen.findByRole("heading", { name: "Hotel settings" });
  });
  it("allows staff review for staff viewers", () => {
    renderHotelPageWithSetupOpen();
    goToSetupStep(7);
    fireEvent.click(screen.getByRole("button", { name: "Review Hotel team" }));
    expect(state.push).toHaveBeenCalledWith("/staff");
  });
  it("hands staff managers without staff viewing permission to an administrator", () => {
    state.user.permissions = ["hotel.view", "admin.staff.manage", "admin.roles.manage"];
    renderHotelPageWithSetupOpen();
    goToSetupStep(7);
    expect(screen.queryByRole("button", { name: "Review Hotel team" })).not.toBeInTheDocument();
    expect(screen.getByText("Ask your administrator to review who has Hotel access.")).toBeInTheDocument();
    expect(screen.getByText("Current front desk work")).toBeInTheDocument();
  });
  it("keeps authorized work usable during a setup API failure", () => {
    state.status = "error"; state.readiness = null;
    renderHotelPageWithSetupOpen();
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't check your hotel setup");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Bookings" }));
    expect(screen.getByText("Bookings work")).toBeInTheDocument();
  });
  it("does not request setup data for housekeeping-only access", () => {
    state.user.permissions = ["hotel.housekeeping.view"];
    render(<HotelPmsPage />);
    expect(screen.queryByRole("region", { name: "Hotel setup" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Housekeeping" })).toBeInTheDocument();
  });
  it("does not expose inventory or rates management to hotel viewers", () => {
    state.user.permissions = ["hotel.view"];
    render(<HotelPmsPage />);
    goToSetupStep(4);
    expect(screen.queryByRole("button", { name: "Add rooms" })).not.toBeInTheDocument();
    goToSetupStep(1);
    expect(screen.queryByRole("button", { name: "Review settings" })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Rooms" }));
    expect(screen.getByText("Rooms mode: book")).toBeInTheDocument();
  });
});
