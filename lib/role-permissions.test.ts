import { describe, expect, it } from "vitest";

import {
  filterSidebarLinksByAccess,
  getHomeRouteForUser,
  getSidebarItemsForRoles,
  isPathAccessible,
  isRouteAllowed,
  getHotelWorkspaceTabs,
  hasPermission,
  getAttendanceUiAccess,
  canRedeemOrderLoyalty,
} from "@/lib/role-permissions";

describe("effective permission screen access", () => {
  it("requires loyalty management and order edit for loyalty redemption", () => {
    expect(
      canRedeemOrderLoyalty({ role: "user", permissions: ["pos.order.discount.apply"] }),
    ).toBe(false);
    expect(
      canRedeemOrderLoyalty({ role: "user", permissions: ["customers.loyalty.manage"] }),
    ).toBe(false);
    expect(
      canRedeemOrderLoyalty({ role: "user", permissions: ["customers.loyalty.manage", "pos.order.edit"] }),
    ).toBe(true);
  });

  it("limits attendance tabs and data capabilities to their individual grants", () => {
    expect(
      getAttendanceUiAccess({ role: "user", permissions: ["attendance.view"] }),
    ).toEqual({
      canView: true,
      canManage: false,
      canManageDevices: false,
      canExport: true,
      canPayrollExport: false,
      initialTab: "overview",
    });
    expect(
      getAttendanceUiAccess({ role: "user", permissions: ["attendance.device.manage"] }),
    ).toEqual({
      canView: false,
      canManage: false,
      canManageDevices: true,
      canExport: false,
      canPayrollExport: false,
      initialTab: "devices",
    });
    expect(
      getAttendanceUiAccess({ role: "user", permissions: ["attendance.payroll.export"] }),
    ).toEqual({
      canView: false,
      canManage: false,
      canManageDevices: false,
      canExport: false,
      canPayrollExport: true,
      initialTab: "payroll-export",
    });
  });

  it("allows payroll-export-only staff to open attendance for that action", () => {
    const user = {
      role: "user",
      permissions: ["attendance.payroll.export"],
    };
    expect(
      isRouteAllowed("/attendance", user),
    ).toBe(true);
    expect(
      getSidebarItemsForRoles([], user).some((item) => item.href === "/attendance"),
    ).toBe(true);
  });

  it("allows a custom-role user into the finance page granted to them", () => {
    const user = {
      role: "user",
      roles: ["Shift Lead"],
      permissions: ["finance.expenses.view"],
    };

    expect(isRouteAllowed("/finance/expenses", user)).toBe(true);
    expect(isRouteAllowed("/finance/income", user)).toBe(false);
  });

  it("keeps a mixed custom POS-and-accounting role independent of built-in waiter/cashier roles", () => {
    const hybridStaff = {
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

    expect(isRouteAllowed("/orders/new", hybridStaff)).toBe(true);
    expect(isRouteAllowed("/orders/31583/edit", hybridStaff)).toBe(true);
    expect(isRouteAllowed("/finance/accounting", hybridStaff)).toBe(true);
    expect(isRouteAllowed("/finance/income", hybridStaff)).toBe(false);
    expect(isRouteAllowed("/cash-drawers", hybridStaff)).toBe(false);
    expect(isRouteAllowed("/manage/roles", hybridStaff)).toBe(false);
    expect(getHomeRouteForUser(hybridStaff)).toBe("/orders/active");

    const visibleLinks = getSidebarItemsForRoles([], hybridStaff).map((item) => item.href);
    expect(visibleLinks).toContain("/orders");
    expect(visibleLinks).toContain("/orders/new");
    expect(visibleLinks).toContain("/finance/accounting");
    expect(visibleLinks).not.toContain("/finance/income");
    expect(visibleLinks).not.toContain("/cash-drawers");
    expect(visibleLinks).not.toContain("/manage/roles");
  });

  it("keeps order history available through the backend POS view grant", () => {
    const waiter = {
      role: "waiter",
      permissions: ["pos.view"],
    };

    expect(isPathAccessible("/orders/history", waiter)).toBe(true);
    expect(
      isPathAccessible("/orders/history", { ...waiter, permissions: [] }),
    ).toBe(false);
  });

  it("lands a waiter with order-create-only access on the screen they can use", () => {
    const user = {
      role: "waiter",
      permissions: ["pos.order.create", "menu.view"],
    };

    expect(getHomeRouteForUser(user)).toBe("/orders/new");
    const incompleteAccess = { role: "waiter", permissions: ["pos.order.create"] };
    expect(isRouteAllowed("/orders/new", incompleteAccess)).toBe(false);
    expect(
      getSidebarItemsForRoles(["waiter"], incompleteAccess).some((item) => item.href === "/orders/new"),
    ).toBe(false);
  });

  it("requires order view and edit access for an order edit route", () => {
    expect(
      isRouteAllowed("/orders/123/edit", {
        role: "waiter",
        permissions: ["pos.view"],
      }),
    ).toBe(false);
    expect(
      isRouteAllowed("/orders/123/edit", {
        role: "user",
        permissions: ["pos.order.edit"],
      }),
    ).toBe(false);
    expect(
      isRouteAllowed("/orders/123/edit", {
        role: "user",
        permissions: ["pos.view", "pos.order.edit"],
      }),
    ).toBe(true);
  });

  it("allows a role manager to open only the role-management settings page", () => {
    const user = {
      role: "user",
      roles: ["Custom Staff"],
      permissions: ["admin.roles.manage"],
    };

    expect(isRouteAllowed("/settings/roles", user)).toBe(true);
    expect(isRouteAllowed("/settings/branding", user)).toBe(false);
  });

  it("allows custom staff managers to open join requests without staff-view access", () => {
    const user = {
      role: "user",
      roles: ["Recruiter"],
      permissions: ["admin.staff.manage"],
    };

    expect(isRouteAllowed("/staff/join-requests", user)).toBe(true);
    expect(isPathAccessible("/staff/join-requests", user)).toBe(true);
    expect(isRouteAllowed("/staff/123", user)).toBe(false);
  });

  it("keeps the transactions sidebar link under ledger access, not analytics access", () => {
    const analyticsOnly = {
      role: "user",
      roles: ["Analytics reviewer"],
      permissions: ["reports.analytics.view"],
    };
    const ledgerOnly = {
      role: "user",
      roles: ["Ledger reviewer"],
      permissions: ["finance.ledger.view"],
    };

    expect(getSidebarItemsForRoles([], analyticsOnly).some((item) => item.href === "/transactions")).toBe(false);
    expect(getSidebarItemsForRoles([], ledgerOnly).some((item) => item.href === "/transactions")).toBe(true);
  });

  it("requires analytics view in addition to drilldown access", () => {
    const drilldownOnly = {
      role: "user",
      roles: ["Drilldown analyst"],
      permissions: ["reports.analytics.drilldown"],
    };

    expect(hasPermission(drilldownOnly, "reports.analytics.view")).toBe(false);
    expect(isPathAccessible("/analytics", drilldownOnly)).toBe(false);
  });

  it("expands platform billing manage only into platform permissions", () => {
    const billingAdmin = {
      role: "user",
      roles: ["Platform billing admin"],
      permissions: ["platform.billing.manage"],
    };

    expect(hasPermission(billingAdmin, "platform.billing.publish")).toBe(true);
    expect(hasPermission(billingAdmin, "platform.billing.view")).toBe(true);
    expect(hasPermission(billingAdmin, "finance.accounting.view")).toBe(false);
  });

  it("lets station-specific kitchen staff open their shared station workspace", () => {
    const user = {
      role: "user",
      roles: ["Bar Team"],
      permissions: ["station.bar.view"],
    };

    expect(isRouteAllowed("/kitchen", user)).toBe(true);
    expect(
      getSidebarItemsForRoles([], user).some(
        (item) => item.href === "/kitchen",
      ),
    ).toBe(true);
  });

  it("lets a housekeeping-only grant open the hotel workspace", () => {
    const user = {
      role: "user",
      roles: ["Housekeeping"],
      permissions: ["hotel.housekeeping.view"],
    };

    expect(isRouteAllowed("/hotel", user)).toBe(true);
    expect(
      filterSidebarLinksByAccess(
        [{ title: "Hotel PMS", href: "/hotel" }],
        user,
      ),
    ).toHaveLength(1);
  });

  it("shows only hotel tabs whose backend read permissions are granted", () => {
    expect(getHotelWorkspaceTabs({
      role: "user", roles: ["Front desk"], permissions: ["hotel.view"],
    })).toEqual(["front-desk", "bookings", "inventory", "rates"]);
    expect(getHotelWorkspaceTabs({
      role: "user", roles: ["Housekeeping"], permissions: ["hotel.housekeeping.view"],
    })).toEqual(["housekeeping"]);
    expect(getHotelWorkspaceTabs({
      role: "user", roles: ["Night audit"], permissions: ["hotel.night_audit.run"],
    })).toEqual([]);
    expect(getHotelWorkspaceTabs({
      role: "user", roles: ["Hotel manager"], permissions: ["hotel.view", "hotel.night_audit.run", "reports.analytics.view", "finance.income.view", "reports.dayclose.view"],
    })).toEqual(["front-desk", "bookings", "inventory", "rates", "room-orders", "finance", "daybook", "night-audit"]);
  });

  it("filters nested navigation links by each destination permission", () => {
    const navigation = [
      {
        title: "Finance",
        href: "/finance/income",
        subItems: [
          { title: "Income", href: "/finance/income" },
          { title: "Expenses", href: "/finance/expenses" },
        ],
      },
    ];

    expect(
      filterSidebarLinksByAccess(navigation, {
        role: "user",
        roles: ["Shift Lead"],
        permissions: ["finance.expenses.view"],
      }),
    ).toEqual([
      {
        title: "Finance",
        href: "/finance/expenses",
        subItems: [{ title: "Expenses", href: "/finance/expenses" }],
      },
    ]);
  });

  it("mirrors backend permission implications for legacy grants", () => {
    const user = { role: "user", permissions: ["inventory.stock.manage"] };
    expect(hasPermission(user, "inventory.items.manage")).toBe(true);
    expect(hasPermission(user, "inventory.purchase_returns.create")).toBe(true);
    expect(hasPermission(user, "inventory.stations.view")).toBe(true);
  });

  it("does not let a platform permission bypass restaurant access", () => {
    const platformStaff = {
      role: "platform_staff",
      permissions: ["platform.restaurants.view"],
    };
    expect(hasPermission(platformStaff, "platform.restaurants.view")).toBe(true);
    expect(hasPermission(platformStaff, "pos.view")).toBe(false);
    expect(isRouteAllowed("/orders/active", platformStaff)).toBe(false);
  });

  it("allows a cashier to open orders only when both screen and payment grants exist", () => {
    expect(
      isRouteAllowed("/orders/123/checkout", {
        role: "user",
        permissions: ["billing.payment.process"],
      }),
    ).toBe(false);
    expect(
      isRouteAllowed("/orders/123/checkout", {
        role: "user",
        permissions: ["pos.view", "billing.payment.process"],
      }),
    ).toBe(true);
  });

  it("keeps the refund register under its backend report permission", () => {
    expect(
      isRouteAllowed("/finance/reports/refunds", {
        role: "user",
        permissions: ["finance.reports.payments.view"],
      }),
    ).toBe(true);
    expect(
      isRouteAllowed("/finance/reports/refunds", {
        role: "user",
        permissions: ["billing.refund.process"],
      }),
    ).toBe(false);
  });

  it("requires both analytics access and the period-insights grant for compare", () => {
    expect(
      isRouteAllowed("/analytics/compare", {
        role: "user",
        permissions: ["reports.analytics.view"],
      }),
    ).toBe(false);
    expect(
      isRouteAllowed("/analytics/compare", {
        role: "user",
        permissions: ["reports.analytics.view", "reports.period.insights"],
      }),
    ).toBe(true);
  });
});

 describe("permission-based landing pages", () => {
  it.each([
    [["finance.accounting.view"], "/finance/reports"],
    [["station.bar.view"], "/kitchen"],
    [[], "/manage/profile"],
  ])("does not send custom tenant roles to a forbidden dashboard: %s", (permissions, expected) => {
    const user = { role: "custom_clerk", roles: ["custom_clerk"], restaurant_id: 52, permissions };
    expect(getHomeRouteForUser(user)).toBe(expected);
    expect(isRouteAllowed(expected, user)).toBe(true);
  });
  it("lands waiters on Orders even when dashboard is granted", () => {
    expect(getHomeRouteForUser({role: "waiter", permissions: ["pos.view", "dashboard.view"]})).toBe("/orders/active");
  });
 });

describe("payment report navigation", () => {
 it.each(["billing.view", "finance.ledger.view", "finance.payment_settlements.manage", "finance.income.view"])("does not offer Payments with unrelated permission %s", permission => {
  expect(isPathAccessible("/finance/payments", {role: "waiter", permissions: [permission]})).toBe(false);
 });
 it("offers both Payments aliases with payment report access", () => {
  const user = {role: "custom", permissions: ["finance.reports.payments.view"]};
  expect(isPathAccessible("/finance/payments", user)).toBe(true);
  expect(isPathAccessible("/finance/reports/payments", user)).toBe(true);
 });
});

it("own-drawer cashier access does not grant the business-wide Cash & Banks screen",()=>{
 const user={role:"cashier",permissions:["finance.drawer.open.own","finance.drawer.close.own","day_close.drawer.open"]};
 expect(isPathAccessible("/cash-drawers",user)).toBe(true);
 expect(isPathAccessible("/finance/operations",user)).toBe(false);
});
