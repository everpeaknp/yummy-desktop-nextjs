import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({user: null as any}));
vi.mock("next/navigation", () => ({usePathname: () => "/orders"}));
vi.mock("@/hooks/use-auth", () => ({useAuth: (select: any) => select({user: state.user})}));
vi.mock("@/hooks/use-restaurant", () => ({useRestaurant: (select: any) => select({restaurant: {restaurant_enabled: true, hotel_enabled: false}})}));
vi.mock("@/hooks/use-subscription", () => ({useSubscriptionStore: (select: any) => select({current: null})}));
import { MobileBottomNav } from "./mobile-bottom-nav";
afterEach(cleanup);
describe("mobile allowed navigation", () => {
 it("shows Orders once and no dashboard for a restricted waiter", () => {
  state.user = {role: "waiter", permissions: ["pos.view"]}; render(<MobileBottomNav />);
  const hrefs = screen.getAllByRole("link").map(link => link.getAttribute("href"));
  expect(hrefs.filter(href => href === "/orders")).toHaveLength(1);
  expect(hrefs).not.toContain("/dashboard"); expect(hrefs).not.toContain("/analytics");
 });
 it("retains only personal profile without any screen grants", () => {
  state.user = {role: "custom", permissions: []}; render(<MobileBottomNav />);
  expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/manage/profile"]);
 });
});
