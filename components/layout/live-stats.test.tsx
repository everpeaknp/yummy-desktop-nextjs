import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: null as any, get: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: (select: any) => select({user: state.user}) }));
vi.mock("@/hooks/use-restaurant", () => ({ useRestaurant: (select: any) => select({restaurant: {restaurant_enabled: true}}) }));
vi.mock("@/lib/api-client", () => ({default: {get: state.get}}));
import { LiveStats } from "./live-stats";
afterEach(cleanup);
beforeEach(() => {
 state.get.mockReset();
 state.get.mockResolvedValue({data: {status: "success", data: {home: {shift_pulse: {active_orders: 3, kot_pending: 2}}, kpis: {gross_sales: 400}}}});
});
const setUser = (permissions: string[]) => {state.user = {id: 505, role: "waiter", restaurant_id: 52, permissions};};
describe("navbar statistics permissions", () => {
 it("never requests dashboard data for a POS-only waiter", async () => {
  setUser(["pos.view"]); render(<LiveStats />);
  expect(state.get).not.toHaveBeenCalled(); expect(screen.queryAllByRole("link")).toHaveLength(0);
 });
 it("hides POS destinations and sales for dashboard-only users", async () => {
  setUser(["dashboard.view"]); render(<LiveStats />);
  await waitFor(() => expect(state.get).toHaveBeenCalledTimes(1));
  expect(screen.queryAllByRole("link")).toHaveLength(0);
 });
 it("shows operational links without sales when only dashboard and POS are granted", async () => {
  setUser(["dashboard.view", "pos.view"]); render(<LiveStats />);
  expect(await screen.findByRole("link", {name: /orders/i})).toHaveAttribute("href", "/orders");
  expect(screen.getByRole("link", {name: /KOT/})).toHaveAttribute("href", "/orders?tab=kot");
  expect(screen.queryByRole("link", {name: /today/})).not.toBeInTheDocument();
 });
 it("shows sales only with analytics grant", async () => {
  setUser(["dashboard.view", "reports.analytics.view"]); render(<LiveStats />);
  expect(await screen.findByRole("link", {name: /today/})).toHaveAttribute("href", "/analytics");
 });
 it("ignores a pending response when dashboard permission is revoked", async () => {
  let finish!: (value: any) => void;
  state.get.mockImplementation(() => new Promise(resolve => {finish = resolve;}));
  setUser(["dashboard.view", "pos.view"]); const view = render(<LiveStats />);
  setUser(["pos.view"]); view.rerender(<LiveStats />);
  await act(async () => finish({data: {status: "success", data: {}}}));
  expect(screen.queryAllByRole("link")).toHaveLength(0);
 });
});
