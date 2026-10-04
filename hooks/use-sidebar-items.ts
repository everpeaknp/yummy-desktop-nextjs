"use client";

import { useMemo } from "react";
import {
  LayoutDashboard,
  LayoutGrid,
  UtensilsCrossed,
  ChefHat,
  ClipboardList,
  Users,
  Settings,
  CreditCard,
  Package,
  Plus,
  Activity,
  Receipt,
  ArrowDownUp,
  Armchair,
  Calendar,
  Percent,
  MessageSquare,
  Zap,
  BedDouble,
  BarChart3,
  Briefcase,
  LucideIcon,
  Banknote,
  Fingerprint,
  FileText,
  ShoppingCart,
  Truck,
  BookOpenCheck,
  BadgeDollarSign,
  Sprout,
  Megaphone,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  normalizeRolesForUser,
  getSidebarItemsForRoles,
  hasPermission,
  filterSidebarLinksByAccess,
  isPathAccessible,
} from "@/lib/role-permissions";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useSubscriptionStore } from "@/hooks/use-subscription";
import { isSubscriptionEntitlementEnabled } from "@/lib/subscription/entitlements";
import { isFinanceFeatureEnabled } from "@/lib/finance-feature-access";
export interface SidebarItem {
  title: string;
  href: string;
  icon: LucideIcon;
  section?: string; // optional group label
  externalUrl?: string;
  subItems?: SidebarItem[];
  isNestedChild?: boolean;
  /** Inline quick-create link rendered to the right of this item's label. */
  quickCreateHref?: string;
  quickCreateLabel?: string;
}

const RESTAURANT_ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/orders": ClipboardList,
  "/orders/active": ClipboardList,
  "/orders/history": ClipboardList,
  "/orders/new": Plus,
  "/analytics": Activity,
  "/day-close": Receipt,
  "/cash-drawers": Banknote,
  "/transactions": ArrowDownUp,
  "/menu/items": UtensilsCrossed,
  "/menu/categories": LayoutGrid,
  "/menu/modifiers": Settings,
  "/kitchen": ChefHat,
  "/inventory": Package,
  "/suppliers": Truck,
  "/finance/income": CreditCard,
  "/finance": CreditCard,
  "/finance/sales": Receipt,
  "/finance/purchases": ShoppingCart,
  "/inventory/purchases": ShoppingCart,
  "/finance/income-expenses": CreditCard,
  "/finance/transactions": ArrowDownUp,
  "/finance/reports": FileText,
  "/finance/setup": Settings,
  "/finance/operations": Banknote,
  "/customers": Users,
  "/grow": Sprout,
  "/grow/campaigns": Megaphone,
  "/grow/subscribers": Users,
  "/attendance": Fingerprint,
  "/staff": Users,
  "/workforce": Briefcase,
  "/tables": Armchair,
  "/reservations": Calendar,
  "/discounts": Percent,
  "/settings": Settings,
  "/feedback": MessageSquare,
  "/premium": Zap,
};

const HOTEL_SIDEBAR_BASE: SidebarItem[] = [
  { title: "Hotel PMS", href: "/hotel", icon: BedDouble, section: "Hotel" },
  { title: "Orders", href: "/orders", icon: ClipboardList, section: "Hotel" },
  {
    title: "Order History",
    href: "/orders/history",
    icon: ClipboardList,
    section: "Hotel",
  },
  { title: "New Order", href: "/orders/new", icon: Plus, section: "Hotel" },
  {
    title: "Finance",
    href: "/finance/income",
    icon: CreditCard,
    section: "Hotel",
  },
  { title: "Customers", href: "/customers", icon: Users, section: "Hotel" },
  { title: "Settings", href: "/settings", icon: Settings, section: "Hotel" },
];

function getHotelSidebarItems(
  user: {
    role?: string | null;
    roles?: string[] | null;
    permissions?: string[];
  } | null,
): SidebarItem[] {
  const base = filterSidebarLinksByAccess(HOTEL_SIDEBAR_BASE, user);

  if (!hasPermission(user, "reports.analytics.view")) {
    return base;
  }

  const financeIndex = base.findIndex(
    (item) => item.href === "/finance/income",
  );
  const analyticsItem: SidebarItem = {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    section: "Hotel",
  };

  if (base.some((item) => item.href === analyticsItem.href)) {
    return base;
  }

  if (financeIndex < 0) {
    const settingsIndex = base.findIndex((item) => item.href === "/settings");
    const insertAt = settingsIndex >= 0 ? settingsIndex : base.length;
    return [...base.slice(0, insertAt), analyticsItem, ...base.slice(insertAt)];
  }

  return [
    ...base.slice(0, financeIndex),
    analyticsItem,
    ...base.slice(financeIndex),
  ];
}

const HOTEL_CASHIER_ITEMS: SidebarItem[] = [
  { title: "Hotel PMS", href: "/hotel", icon: BedDouble, section: "Hotel" },
  { title: "Orders", href: "/orders", icon: ClipboardList, section: "Hotel" },
  {
    title: "Order History",
    href: "/orders/history",
    icon: ClipboardList,
    section: "Hotel",
  },
  { title: "New Order", href: "/orders/new", icon: Plus, section: "Hotel" },
  {
    title: "Finance",
    href: "/finance/income",
    icon: CreditCard,
    section: "Hotel",
  },
  { title: "Customers", href: "/customers", icon: Users, section: "Hotel" },
];

export function useSidebarItems(): SidebarItem[] {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((s) => s.restaurant);
  const currentSubscription = useSubscriptionStore((state) => state.current);

  return useMemo(() => {
    const isExplicitlyLocked = (key: string, legacyFallback = true) =>
      Boolean(currentSubscription) &&
      !isSubscriptionEntitlementEnabled(currentSubscription, key, legacyFallback);
    const roles = normalizeRolesForUser(user);
    const isAdminOrManager = roles.some(
      (r) => r === "admin" || r === "manager",
    );
    const isCashier = roles.some((r) => r === "cashier");

    const hotelAvailable = Boolean(restaurant?.hotel_enabled);
    const restaurantAvailable = Boolean(restaurant?.restaurant_enabled);

    // Hotel-only properties keep hotel operations plus permitted shared tools.
    if (hotelAvailable && !restaurantAvailable) {
      if (isAdminOrManager) return getHotelSidebarItems(user);
      if (isCashier)
        return filterSidebarLinksByAccess(HOTEL_CASHIER_ITEMS, user);
      // Other hotel staff see the PMS entry point when their role permits it.
      return filterSidebarLinksByAccess(
        [{ title: "Hotel PMS", href: "/hotel", icon: BedDouble }],
        user,
      );
    }

    // Restaurant and shared navigation. Dual properties add Hotel PMS below;
    // there is no global workspace mode.
    const restaurantOnlyItems = [
      "/orders",
      "/orders/new",
      "/kitchen",
      "/tables",
      "/reservations",
    ];
    const flatItems: SidebarItem[] = getSidebarItemsForRoles(roles, user)
      .filter((item) => {
        // Remove Feedback from sidebar entirely (it is accessed via profile dropdown)
        if (item.href === "/feedback") return false;
        // If restaurant not enabled, don't show restaurant-specific items
        if (
          !restaurant?.restaurant_enabled &&
          restaurantOnlyItems.includes(item.href)
        )
          return false;
        const entitlementByRoute: Record<string, string> = {
          "/inventory": "inventory.enabled",
          "/manage/suppliers": "inventory.suppliers.enabled",
          "/reservations": "reservations.enabled",
          "/payroll": "payroll.enabled",
          "/finance/accounting": "finance.accounting.enabled",
          "/menu/modifiers": "menu.modifiers.enabled",
          "/finance/income": "finance.income_expense.enabled",
          "/finance/expenses": "finance.income_expense.enabled",
          "/cash-drawers": "finance.cash_drawer.enabled",
          "/customers": "customers.crm.enabled",
          "/grow": "grow.enabled",
          "/day-close": "finance.daybook.enabled",
          "/period-reports": "finance.period_close.enabled",
          "/manage/receipt-designer": "designers.receipt.enabled",
          "/manage/kot-designer": "designers.kot.enabled",
        };
        const requiredEntitlement = entitlementByRoute[item.href];
        if (
          requiredEntitlement &&
          isExplicitlyLocked(requiredEntitlement, item.href !== "/grow")
        )
          return false;
        return true;
      })
      .map((item) => ({
        title: item.href === "/finance/income" ? "Income" : item.title,
        href: item.href,
        icon: RESTAURANT_ICON_MAP[item.href] ?? LayoutDashboard,
        externalUrl: item.externalUrl,
      }));

    const secondaryItems: SidebarItem[] = [
      { title: "Expenses", href: "/finance/expenses", icon: CreditCard },
      { title: "Reports", href: "/finance/reports", icon: FileText },
      { title: "Chart of Accounts", href: "/finance/heads", icon: FileText },
      { title: "Sales", href: "/finance/sales", icon: Receipt },
      { title: "Purchases", href: "/inventory/purchases", icon: ShoppingCart },
      { title: "Other Income", href: "/finance/other-income", icon: CreditCard },
      { title: "Payments", href: "/finance/payments", icon: BadgeDollarSign },
      { title: "Transactions", href: "/finance/transactions", icon: ArrowDownUp },
      { title: "Cash & Banks", href: "/finance/operations", icon: Banknote },
      { title: "Cash Drawers", href: "/cash-drawers", icon: Banknote },
      { title: "Day Close", href: "/day-close", icon: Receipt },
      { title: "Journal Vouchers", href: "/finance/journals", icon: BookOpenCheck },
      { title: "Setup", href: "/finance/setup", icon: Settings },
    ];
    for (const item of filterSidebarLinksByAccess(secondaryItems, user)) {
      const entitlementByRoute: Record<string, string> = {
        "/finance/expenses": "finance.income_expense.enabled",
        "/finance/reports": "finance.income_expense.enabled",
        "/finance/setup": "finance.accounting.enabled",
        "/cash-drawers": "finance.cash_drawer.enabled",
        "/day-close": "finance.daybook.enabled",
      };
      const requiredEntitlement = entitlementByRoute[item.href];
      if (
        (!requiredEntitlement || !isExplicitlyLocked(requiredEntitlement)) &&
        !flatItems.some((existing) => existing.href === item.href)
      ) {
        flatItems.push({ ...item, isNestedChild: true });
      }
    }

    // Grouping logic for premium aesthetic
    const groups: { [key: string]: SidebarItem } = {};
    const result: SidebarItem[] = [];

    const getGroup = (
      id: string,
      title: string,
      icon: LucideIcon,
      href: string,
    ) => {
      if (!groups[id]) {
        groups[id] = { title, href, icon, subItems: [] };
        result.push(groups[id]);
      }
      return groups[id];
    };

    flatItems.forEach((item) => {
      if (["/staff", "/attendance"].includes(item.href)) {
        // Workforce is assembled as one owner-oriented workflow below.
        return;
      } else if (item.href === "/orders/history") {
        // Skip history, it's inside the Orders page
        return;
      } else if (item.href === "/orders") {
        result.push(item);
      } else if (item.href === "/orders/new") {
        result.push({ ...item, isNestedChild: true });
      } else if (item.href === "/grow") {
        result.push({
          ...item,
          ...(hasPermission(user, "grow.campaigns.manage")
            ? { quickCreateHref: "/grow/campaigns/new", quickCreateLabel: "New campaign" }
            : {}),
        });
      } else if (item.href === "/grow/campaigns") {
        result.push({ ...item, isNestedChild: true });
      } else if (item.href === "/grow/subscribers") {
        result.push({ ...item, isNestedChild: true });
      } else if (
        ["/menu/items", "/menu/categories", "/menu/modifiers"].includes(
          item.href,
        )
      ) {
        const group = getGroup("menu", "Menu", UtensilsCrossed, "/menu/items");
        if (item.href !== "/menu/items") group.subItems!.push(item);
      } else if (["/tables", "/reservations"].includes(item.href)) {
        const group = getGroup("tables", "Table & Space", Armchair, "/tables");
        group.subItems!.push(item);
      } else if (["/kitchen", "/discounts"].includes(item.href)) {
        const group = getGroup(
          "services",
          "Services",
          ChefHat,
          item.href === "/kitchen" ? "/kitchen" : item.href,
        );
        group.subItems!.push(item);
      } else if (
        [
          "/cash-drawers",
          "/finance/income",
          "/finance/expenses",
          "/finance/reports",
          "/finance/sales",
          "/finance/other-income",
          "/finance/payments",
          "/finance/transactions",
          "/finance/operations",
          "/finance/setup",
          "/finance/journals",
          "/finance/accounting",
          "/transactions",
          "/day-close",
          "/finance/heads",
          "/inventory/purchases",
        ].includes(item.href)
      ) {
        const group = getGroup(
          "finance",
          "Finance",
          CreditCard,
          "/finance/income",
        );
        group.subItems!.push(item);
      } else if (item.href === "/settings") {
        result.push(item);
      } else if (item.href === "/inventory") {
        result.push(item);
      } else if (["/suppliers", "/manage/suppliers"].includes(item.href)) {
        result.push({
          ...item,
          title: "Suppliers",
          href: "/suppliers",
          icon: Truck,
        });
      } else {
        result.push(item);
      }
    });

    const workforceItems: SidebarItem[] = [];
    if (hasPermission(user, "admin.staff.view")) {
      workforceItems.push({
        title: "Staff",
        href: "/staff",
        icon: Users,
        isNestedChild: true,
      });
    }
    if (
      hasPermission(user, "attendance.view") ||
      hasPermission(user, "attendance.manage")
    ) {
      workforceItems.push({
        title: "Attendance",
        href: "/attendance",
        icon: Fingerprint,
        isNestedChild: true,
      });
    }
    if (workforceItems.length) {
      const group = getGroup("workforce", "Workforce", Briefcase, "/workforce");
      group.subItems = workforceItems;
    }

    if (
      (
        [
          "finance.daybook.view",
          "finance.drawer.transfer.to_safe",
          "finance.cash.transfer.to_bank",
        ] as const
      ).some((permission) => hasPermission(user, permission))
    ) {
      const group = getGroup(
        "finance",
        "Finance",
        CreditCard,
        "/finance/operations",
      );
      group.href = "/finance/operations";
      const subItems = group.subItems ?? [];
      if (!subItems.some((item) => item.href === "/finance/operations")) {
        subItems.unshift({
          title: "Cash & Banks",
          href: "/finance/operations",
          icon: Banknote,
          isNestedChild: true,
        });
      }
      group.subItems = subItems;
    }

    if (hasPermission(user, "finance.income.view")) {
      const group = getGroup(
        "finance",
        "Finance",
        CreditCard,
        "/finance/income",
      );
      const subItems = group.subItems ?? [];
      if (!subItems.some((item) => item.href === "/finance/expenses")) {
        subItems.push({
          title: "Expenses",
          href: "/finance/expenses",
          icon: CreditCard,
          isNestedChild: true,
        });
      }
      if (!subItems.some((item) => item.href === "/finance/reports")) {
        subItems.push({
          title: "Reports",
          href: "/finance/reports",
          icon: FileText,
          isNestedChild: true,
        });
      }
      group.subItems = subItems;
    }

    if (hasPermission(user, "finance.coa.view")) {
      const group = getGroup(
        "finance",
        "Finance",
        CreditCard,
        "/finance/heads",
      );
      const subItems = group.subItems ?? [];
      if (!subItems.some((item) => item.href === "/finance/heads")) {
        subItems.push({
          title: "Chart of Accounts",
          href: "/finance/heads",
          icon: FileText,
          isNestedChild: true,
        });
      }
      group.subItems = subItems;
    }

    // Finance navigation names the document/register being opened. Receivables
    // belong to Customers and payables belong to Suppliers, so those party
    // balances are not duplicated as Finance sidebar destinations.
    const financeGroup = groups.finance;
    if (financeGroup && hasPermission(user, "finance.income.view")) {
      const financeItems: SidebarItem[] = [
        {
          title: "Overview",
          href: "/finance",
          icon: CreditCard,
          isNestedChild: true,
        },
        {
          title: "Sales",
          href: "/finance/sales",
          icon: Receipt,
          isNestedChild: true,
        },
        {
          title: "Purchases",
          href: "/inventory/purchases",
          icon: ShoppingCart,
          isNestedChild: true,
        },
        {
          title: "Other Income",
          href: "/finance/other-income",
          icon: CreditCard,
          isNestedChild: true,
        },
        {
          title: "Expenses",
          href: "/finance/expenses",
          icon: CreditCard,
          isNestedChild: true,
        },
        {
          title: "Payments",
          href: "/finance/payments",
          icon: BadgeDollarSign,
          isNestedChild: true,
        },
        {
          title: "Transactions",
          href: "/finance/transactions",
          icon: ArrowDownUp,
          isNestedChild: true,
        },
      ];

      if (
        (
          [
            "finance.daybook.view",
            "finance.drawer.transfer.to_safe",
            "finance.cash.transfer.to_bank",
          ] as const
        ).some((permission) => hasPermission(user, permission))
      ) {
        financeItems.splice(6, 0, {
          title: "Cash & Banks",
          href: "/finance/operations",
          icon: Banknote,
          isNestedChild: true,
        });
      }

      if (hasPermission(user, "day_close.drawer.open")) {
        const cashBanksIndex = financeItems.findIndex(
          (item) => item.href === "/finance/operations",
        );
        financeItems.splice(
          cashBanksIndex >= 0 ? cashBanksIndex + 1 : financeItems.length,
          0,
          {
            title: "Cash Drawers",
            href: "/cash-drawers",
            icon: Banknote,
            isNestedChild: true,
          },
        );
      }

      if (hasPermission(user, "finance.daybook.view")) {
        const cashDrawersIndex = financeItems.findIndex(
          (item) => item.href === "/cash-drawers",
        );
        financeItems.splice(
          cashDrawersIndex >= 0 ? cashDrawersIndex + 1 : financeItems.length,
          0,
          {
            title: "Day Close",
            href: "/day-close",
            icon: Receipt,
            isNestedChild: true,
          },
        );
      }

      if (hasPermission(user, "finance.journal.view")) {
        financeItems.push({
          title: "Journal Vouchers",
          href: "/finance/journals",
          icon: BookOpenCheck,
          isNestedChild: true,
        });
      }

      if (hasPermission(user, "finance.accounting.view")) {
        financeItems.push({
          title: "Accounting",
          href: "/finance/accounting",
          icon: FileText,
          isNestedChild: true,
        });
      }

      if (isFinanceFeatureEnabled(restaurant, "reports")) {
        financeItems.push({
          title: "Reports",
          href: "/finance/reports",
          icon: FileText,
          isNestedChild: true,
        });
      }
      if (
        hasPermission(user, "finance.coa.view") ||
        hasPermission(user, "finance.payment_instruments.manage")
      ) {
        financeItems.push({
          title: "Setup",
          href: "/finance/setup",
          icon: Settings,
          isNestedChild: true,
        });
      }

      financeGroup.href = "/finance";
      financeGroup.subItems = financeItems;
    }

    if (hotelAvailable) {
      const hotelItem = filterSidebarLinksByAccess(
        [
          {
            title: "Hotel PMS",
            href: "/hotel",
            icon: BedDouble,
            section: "Hotel",
          },
        ],
        user,
      )[0];
      if (hotelItem && !result.some((item) => item.href === hotelItem.href)) {
        const dashboardIndex = result.findIndex(
          (item) => item.href === "/dashboard",
        );
        result.splice(
          dashboardIndex >= 0 ? dashboardIndex + 1 : 0,
          0,
          hotelItem,
        );
      }
    }

    if (
      isPathAccessible("/manage", user) &&
      !result.some((item) => item.href === "/manage")
    ) {
      result.push({ title: "Manage", href: "/manage", icon: LayoutGrid });
    }

    // Keep the optional Grow product grouped after operational navigation.
    const isGrow = (item: SidebarItem) => item.href === "/grow" || item.href.startsWith("/grow/");
    const orderedResult = [
      ...result.filter((item) => !isGrow(item)),
      ...result.filter(isGrow),
    ];

    const cleaned = orderedResult.map((r) => ({
      ...r,
      section: isGrow(r) ? "Yummy Grow" : "Yummy Operations",
      subItems: r.subItems?.length
        ? r.subItems.map((subItem) => ({
            ...subItem,
            section: "Yummy Operations",
          }))
        : undefined,
    }));

    const settingsIndex = cleaned.findIndex(
      (item) => item.href === "/settings" || item.title.toLowerCase() === "settings",
    );
    const growIndex = cleaned.findIndex((item) => item.href === "/grow");
    const desiredSettingsIndex = growIndex >= 0 ? growIndex - 1 : cleaned.length - 1;
    if (settingsIndex >= 0 && settingsIndex !== desiredSettingsIndex) {
      const [settingsItem] = cleaned.splice(settingsIndex, 1);
      const nextGrowIndex = cleaned.findIndex((item) => item.href === "/grow");
      cleaned.splice(nextGrowIndex >= 0 ? nextGrowIndex : cleaned.length, 0, settingsItem);
    }

    return filterSidebarLinksByAccess(cleaned, user);
  }, [currentSubscription, restaurant, user]);
}
