import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mockState = vi.hoisted(() => ({ user: null as any, subscription: null as any }));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: mockState.user }),
}));
vi.mock("@/hooks/use-restaurant", () => ({
  useRestaurant: (selector: (state: { restaurant: unknown }) => unknown) =>
    selector({ restaurant: { restaurant_enabled: true, hotel_enabled: false } }),
}));
vi.mock("@/hooks/use-subscription", () => ({
  useSubscriptionStore: (selector: (state: { current: null }) => unknown) =>
    selector({ current: mockState.subscription }),
}));
vi.mock("@/lib/subscription/entitlements", () => ({
  isSubscriptionEntitlementEnabled: () => false,
}));

import { useSidebarItems } from "@/hooks/use-sidebar-items";

describe("custom-role sidebar journey", () => {
  beforeEach(() => {
    mockState.user = null;
    mockState.subscription = null;
  });

  it("shows only POS and accounting destinations for a mixed custom role", () => {
    mockState.user = {
      role: "user",
      primary_role: "hybrid_pos_accounting",
      roles: ["Hybrid POS & Accounting"],
      permissions: [
        "pos.view",
        "pos.order.create",
        "pos.order.edit",
        "finance.accounting.view",
      ],
    };

    const { result } = renderHook(() => useSidebarItems());
    const links = result.current;
    const hrefs = links.flatMap((item) => [item.href, ...(item.subItems?.map((child) => child.href) ?? [])]);

    expect(hrefs).toContain("/orders");
    expect(hrefs).toContain("/orders/new");
    expect(hrefs).toContain("/finance/accounting");
    expect(hrefs).not.toContain("/finance/income");
    expect(hrefs).not.toContain("/cash-drawers");
    expect(hrefs).not.toContain("/manage/roles");
  });

  it("does not infer cashier or waiter navigation from a custom accounting-only role", () => {
    mockState.user = {
      role: "user",
      primary_role: "accounting_clerk",
      roles: ["Accounting Clerk"],
      permissions: ["finance.accounting.view"],
    };

    const { result } = renderHook(() => useSidebarItems());
    const hrefs = result.current.flatMap((item) => [item.href, ...(item.subItems?.map((child) => child.href) ?? [])]);

    expect(hrefs).toContain("/finance/accounting");
    expect(hrefs).not.toContain("/orders");
    expect(hrefs).not.toContain("/orders/new");
    expect(hrefs).not.toContain("/cash-drawers");
  });

  it("keeps Attendance visible for schedulers when attendance add-ons are locked", () => {
    mockState.user = {
      role: "staff_scheduler",
      permissions: ["attendance.view", "attendance.manage"],
    };
    mockState.subscription = {};

    const { result } = renderHook(() => useSidebarItems());
    const hrefs = result.current.flatMap((item) => [item.href, ...(item.subItems?.map((child) => child.href) ?? [])]);

    expect(hrefs).toContain("/attendance");
  });
});

it("does not build a Finance group from a waiter billing grant", () => {
 mockState.user = {role:"waiter", permissions:["pos.view", "billing.view"]};
 const {result} = renderHook(() => useSidebarItems());
 expect(result.current.some(item => item.title === "Finance")).toBe(false);
});
it("includes Payments for a custom payment-report-only user", () => {
 mockState.user = {role:"custom", permissions:["finance.reports.payments.view"]};
 const {result} = renderHook(() => useSidebarItems());
 const finance = result.current.find(item => item.title === "Finance");
 expect(finance?.subItems?.some(item => item.href === "/finance/payments")).toBe(true);
});
