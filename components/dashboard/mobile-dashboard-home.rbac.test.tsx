import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({permissions: [] as string[]}));
vi.mock("@/hooks/use-auth", () => ({useAuth: (select: any) => select({user: {role: "waiter", permissions: state.permissions}})}));
vi.mock("@/components/dashboard/dashboard-promo-carousel", () => ({DashboardPromoCarousel: () => null}));
import { MobileDashboardHome } from "./mobile-dashboard-home";
afterEach(cleanup);
describe("mobile dashboard financial visibility", () => {
 it.each([false, true])("financial panels follow analytics permission: %s", granted => {
  state.permissions = ["dashboard.view", ...(granted ? ["reports.analytics.view"] : [])];
  render(<MobileDashboardHome home={{quick_insights: {items: [{title: "Sales insight"}]}}} currency="NPR" />);
  for (const label of ["Money snapshot", "Top items", "Sales insight"]) {
   expect(Boolean(screen.queryByText(label))).toBe(granted);
  }
 });
});
