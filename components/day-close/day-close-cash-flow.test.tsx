import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import apiClient from "@/lib/api-client";
import { DayCloseFlow } from "./day-close-flow";

vi.mock("@/lib/api-client", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { role: "admin", full_name: "Owner" } }) }));
vi.mock("@/lib/role-permissions", () => ({ hasPermission: () => true }));
vi.mock("./day-close-financial-details", () => ({
  DayCloseFinancialDetails: () => null, FinancialDetailsButton: () => null,
}));
vi.mock("./drawer-session-panel", () => ({ DrawerSessionPanel: () => null }));

describe("period cash close", () => {
  it("skips the physical count and confirms the saved negative period amount", async () => {
    const snapshot = { cash_basis: "period_activity", expected_cash: -90, net_sales: 100,
      cash_activity: { receipts: 120, payments: 210, net: -90 } };
    const close = { id: 7, restaurant_id: 114, business_date: "2026-11-14", business_line: "restaurant",
      name: "Dinner shift", period_start_at: "2026-11-13T12:00:00Z", period_end_at: "2026-11-14T12:00:00Z", ...snapshot };
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      const path = String(url);
      const data = path.includes("/current?") ? { ...close, status: "open" }
        : path.includes("/validate-close?") ? { can_close: true, drawer_ready: true, issues: [], active_orders_count: 0 }
        : path.includes("/generate-snapshot?") ? snapshot
        : path.endsWith("/snapshot") ? { snapshot_data: snapshot }
        : { enabled: false };
      return { data: { data } };
    });
    vi.mocked(apiClient.post).mockImplementation(async (url) => ({
      data: { data: { ...close, status: String(url).endsWith("/confirm") ? "confirmed" : "pending" } },
    }));
    render(<DayCloseFlow restaurantId={114} businessLine="restaurant" businessDate="2026-11-14" onBusinessDateChange={() => {}} />);
    await screen.findByText("Net cash this period");
    expect(screen.queryByText("Cash counted")).not.toBeInTheDocument();
    expect(screen.queryByText("Cash difference")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Close day" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith("/day-closes/7/confirm", {
      actual_cash: -90, cash_count_source: "not_counted", confirmation_notes: undefined,
    }));
    expect(screen.queryByText("Cash counted")).not.toBeInTheDocument();
  });
});
