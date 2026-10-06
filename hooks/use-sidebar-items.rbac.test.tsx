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

import { getDesktopSidebarItems, useSidebarItems } from "@/hooks/use-sidebar-items";

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

  it("keeps menu.view in POS but hides menu-management navigation", () => {
    mockState.user = {
      role: "custom_order_taker",
      permissions: ["pos.view", "pos.order.create", "menu.view"],
    };

    const { result } = renderHook(() => useSidebarItems());
    const hrefs = result.current.flatMap((item) => [item.href, ...(item.subItems?.map((child) => child.href) ?? [])]);

    expect(hrefs).toContain("/orders/new");
    expect(hrefs).not.toContain("/menu/items");
    expect(hrefs).not.toContain("/menu/categories");
    expect(hrefs).not.toContain("/menu/modifiers");
  });

  it("shows only menu workspaces granted by their management permissions", () => {
    mockState.user = {
      role: "custom_category_manager",
      permissions: ["menu.categories.manage"],
    };

    const { result } = renderHook(() => useSidebarItems());
    const menu = result.current.find((item) => item.title === "Menu");
    const hrefs = result.current.flatMap((item) => [item.href, ...(item.subItems?.map((child) => child.href) ?? [])]);

    expect(menu?.href).toBe("/menu/categories");
    expect(hrefs).toContain("/menu/categories");
    expect(hrefs).not.toContain("/menu/items");
    expect(hrefs).not.toContain("/menu/modifiers");
  });

  it("keeps the item workspace available to a pricing-only manager", () => {
    mockState.user = { role: "custom_pricing_manager", permissions: ["menu.pricing.manage"] };

    const { result } = renderHook(() => useSidebarItems());
    const menu = result.current.find((item) => item.title === "Menu");

    expect(menu?.href).toBe("/menu/items");
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

  it("groups Yummy Grow pages under one parent navigation item", () => {
    mockState.user = {
      role: "manager",
      permissions: ["grow.view", "grow.campaigns.manage"],
    };

    const { result } = renderHook(() => useSidebarItems());
    const growGroup = result.current.find((item) => item.href === "/grow");

    expect(growGroup?.title).toBe("Overview");
    expect(growGroup?.section).toBe("Yummy Grow");
    expect(growGroup?.quickCreateHref).toBe("/grow/campaigns/new");
    expect(growGroup?.subItems?.map((item) => item.href)).toEqual([
      "/grow/campaigns",
      "/grow/subscribers",
    ]);
    expect(result.current.some((item) => item.href === "/grow/campaigns")).toBe(false);
    expect(result.current.some((item) => item.href === "/grow/subscribers")).toBe(false);
  });
});

it("hides Manage from desktop navigation without changing shared navigation", () => {
  const sharedItems = [
    { title: "Dashboard", href: "/dashboard", icon: (() => null) as any },
    { title: "Manage", href: "/manage", icon: (() => null) as any },
  ];

  expect(getDesktopSidebarItems(sharedItems).map((item) => item.href)).toEqual([
    "/dashboard",
  ]);
  expect(sharedItems.map((item) => item.href)).toContain("/manage");
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
