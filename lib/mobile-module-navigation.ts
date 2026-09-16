export type MobileNavigationLevel = "top-level" | "secondary" | "detail";

export type MobileRoutePresentation = {
  title: string;
  navigationLevel: MobileNavigationLevel;
  backFallback?: string;
};

const globalMobileNavigationRoutes = [
  "/dashboard",
  "/orders",
  "/analytics",
  "/manage/profile",
  "/manage",
  "/hotel",
] as const;

const financeReportRouteTitles: Array<
  [string, string, MobileNavigationLevel, string]
> = reportGroups
  .flatMap((group) => group.reports)
  .map((report) => [report.href, report.label, "detail", "/finance/reports"]);

const routeTitles: Array<[string, string, MobileNavigationLevel?, string?]> = [
  ["/orders/new", "New order", "detail", "/orders"],
  ["/orders/history", "Order history", "secondary", "/orders"],
  ["/orders", "Orders", "top-level"],
  ["/analytics", "Analytics", "top-level"],
  ["/manage/profile", "Business profile", "top-level"],
  ["/settings", "Settings", "secondary", "/manage"],
  ["/manage/additional-settings", "Settings", "secondary", "/manage"],
  ["/manage/audit-logs", "Audit logs", "secondary", "/manage"],
  ["/manage/receipt-designer", "Receipt designer", "detail", "/manage"],
  ["/manage/kot-designer", "KOT designer", "detail", "/manage"],
  ["/manage/taxes", "Taxes & fees", "secondary", "/manage"],
  ["/manage/settings", "Restaurant operations", "secondary", "/settings"],
  ["/manage/roles", "Roles", "secondary", "/manage"],
  ["/manage", "Manage", "top-level"],
  [
    "/finance/purchases/returns",
    "Purchase returns",
    "detail",
    "/finance/purchases",
  ],
  ["/finance/purchases", "Purchases", "secondary", "/finance"],
  ["/finance/sales/returns", "Sales returns", "detail", "/finance/sales"],
  ...financeReportRouteTitles,
  ["/finance/reports", "Reports", "secondary", "/finance"],
  ["/finance/other-income", "Other income", "secondary", "/finance"],
  ["/finance/transactions", "Transactions", "secondary", "/finance"],
  ["/finance/journals", "Journal vouchers", "secondary", "/finance"],
  ["/finance/operations", "Cash & banks", "secondary", "/finance"],
  ["/finance/heads", "Chart of accounts", "secondary", "/finance/setup"],
  ["/finance/payments", "Payments", "secondary", "/finance"],
  ["/finance/expenses", "Expenses", "secondary", "/finance"],
  ["/finance/sales", "Sales", "secondary", "/finance"],
  ["/finance/setup", "Finance setup", "secondary", "/finance"],
  ["/cash-drawers", "Cash drawers", "secondary", "/manage"],
  ["/day-close", "Day close", "secondary", "/manage"],
  ["/finance", "Finance", "secondary", "/manage"],
  ["/inventory/purchases", "Purchases", "secondary", "/inventory"],
  ["/inventory", "Inventory", "secondary", "/manage"],
  ["/menu/items", "Menu", "secondary", "/manage"],
  ["/menu/categories", "Categories", "secondary", "/manage"],
  ["/menu/modifiers", "Options & add-ons", "secondary", "/manage"],
  ["/discounts", "Discounts", "secondary", "/manage"],
  ["/customers", "Customers", "secondary", "/manage"],
  ["/suppliers", "Suppliers", "secondary", "/manage"],
  ["/workforce", "Workforce", "secondary", "/manage"],
  ["/premium", "Plans", "secondary", "/manage"],
];

export function shouldMobileBottomNavBeVisible(pathname: string) {
  return globalMobileNavigationRoutes.includes(
    pathname as (typeof globalMobileNavigationRoutes)[number],
  );
}

export function isMobileSecondaryModuleRoute(pathname: string) {
  return !shouldMobileBottomNavBeVisible(pathname);
}

export function getMobileRoutePresentation(
  pathname: string,
): MobileRoutePresentation {
  const orderDetail = pathname.match(
    /^\/orders\/\d+\/(?:checkout|receipt|add-items)/,
  );
  if (orderDetail)
    return {
      title: pathname.includes("checkout")
        ? "Checkout"
        : pathname.includes("receipt")
          ? "Receipt"
          : "Add items",
      navigationLevel: "detail",
      backFallback: "/orders",
    };
  if (/^\/orders\/\d+/.test(pathname))
    return {
      title: "Order",
      navigationLevel: "detail",
      backFallback: "/orders",
    };

  const matched = routeTitles.find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (matched)
    return {
      title: matched[1],
      navigationLevel: matched[2] ?? "secondary",
      backFallback: matched[3],
    };
  if (shouldMobileBottomNavBeVisible(pathname))
    return {
      title: pathname === "/dashboard" ? "Yummy" : "Yummy",
      navigationLevel: "top-level",
    };

  const lastSegment = pathname.split("/").filter(Boolean).at(-1);
  return {
    title: lastSegment
      ? lastSegment
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase())
      : "Yummy",
    navigationLevel: "secondary",
    backFallback: "/manage",
  };
}
import { reportGroups } from "@/components/finance/reports/finance-report-catalog";
