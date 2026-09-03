"use client";

import { useMemo } from "react";
import {
  LayoutDashboard,
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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  normalizeRolesForUser,
  getSidebarItemsForRoles,
  hasPermission,
  filterSidebarLinksByAccess,
} from "@/lib/role-permissions";
import { useRestaurant } from "@/hooks/use-restaurant";
import { useSubscriptionStore } from "@/hooks/use-subscription";
import { isFinanceFeatureEnabled } from "@/lib/finance-feature-access";
import { isSubscriptionEntitlementEnabled } from "@/lib/subscription/entitlements";
export interface SidebarItem {
  title: string;
  href: string;
  icon: LucideIcon;
  section?: string; // optional group label
  externalUrl?: string;
  subItems?: SidebarItem[];
  isNestedChild?: boolean;
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
  "/attendance": Fingerprint,
  "/staff": Users,
  "/workforce": Briefcase,
  "/tables": Armchair,
  "/reservations": Calendar,
  "/discounts": Percent,
  "/manage": Settings,
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
  { title: "Manage", href: "/manage", icon: Settings, section: "Hotel" },
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
    const manageIndex = base.findIndex((item) => item.href === "/manage");
    const insertAt = manageIndex >= 0 ? manageIndex : base.length;
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
    const isExplicitlyLocked = (key: string) =>
      Boolean(currentSubscription) &&
      !isSubscriptionEntitlementEnabled(currentSubscription, key, true);
    const roles = normalizeRolesForUser(user);
    const isAdminOrManager = roles.some(
      (r) => r === "admin" || r === "manager",
    );
    const isCashier = roles.some((r) => r === "cashier");

    const hotelAvailable =
      Boolean(restaurant?.hotel_enabled) &&
      !isExplicitlyLocked("business.hotel.enabled");
    const restaurantAvailable = Boolean(restaurant?.restaurant_enabled);

    // Hotel-only properties keep hotel operations plus permitted shared tools.
    if (hotelAvailable && !restaurantAvailable) {
      if (isAdminOrManager) return getHotelSidebarItems(user);
      if (isCashier)
        return filterSidebarLinksByAccess(HOTEL_CASHIER_ITEMS, user);
      // Other hotel staff see the PMS entry point when their role permits it.
      return [{ title: "Hotel PMS", href: "/hotel", icon: BedDouble }];
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
    const flatItems = getSidebarItemsForRoles(roles, user)
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
          "/suppliers": "inventory.suppliers.enabled",
          "/manage/suppliers": "inventory.suppliers.enabled",
          "/reservations": "reservations.enabled",
          "/finance/accounting": "finance.accounting.enabled",
          "/menu/modifiers": "menu.modifiers.enabled",
          "/finance/income": "finance.income_expense.enabled",
          "/finance/expenses": "finance.income_expense.enabled",
          "/cash-drawers": "finance.cash_drawer.enabled",
          "/customers": "customers.crm.enabled",
          "/day-close": "finance.daybook.enabled",
          "/manage/receipt-designer": "designers.receipt.enabled",
          "/manage/kot-designer": "designers.kot.enabled",
        };
        const requiredEntitlement = entitlementByRoute[item.href];
        if (requiredEntitlement && isExplicitlyLocked(requiredEntitlement))
          return false;
        return true;
      })
      .map((item) => ({
        title: item.href === "/finance/income" ? "Income" : item.title,
        href: item.href,
        icon: RESTAURANT_ICON_MAP[item.href] ?? LayoutDashboard,
        externalUrl: item.externalUrl,
      }));

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
          "/finance/accounting",
          "/transactions",
          "/day-close",
        ].includes(item.href)
      ) {
        const group = getGroup(
          "finance",
          "Finance",
          CreditCard,
          "/finance/income",
        );
        group.subItems!.push(item);
      } else if (["/manage", "/settings"].includes(item.href)) {
        const group = getGroup("settings", "Settings", Settings, "/manage");
        if (item.href !== "/manage") group.subItems!.push(item);
      } else if (item.href === "/inventory") {
        result.push(item);
      } else if (["/suppliers", "/manage/suppliers"].includes(item.href)) {
        result.push({ ...item, title: "Suppliers", href: "/suppliers", icon: Truck });
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
      hasPermission(user, "attendance.manage") &&
      !(
        isExplicitlyLocked("attendance.mobile.enabled") &&
        isExplicitlyLocked("attendance.biometric.enabled")
      )
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
      ([
        "finance.daybook.view",
        "finance.drawer.transfer.to_safe",
        "finance.cash.transfer.to_bank",
      ] as const).some((permission) => hasPermission(user, permission))
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

    if (
      hasPermission(user, "finance.income.view") &&
      !isExplicitlyLocked("finance.income_expense.enabled")
    ) {
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
      if (
        isFinanceFeatureEnabled(restaurant, "reports") &&
        !subItems.some((item) => item.href === "/finance/reports")
      ) {
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
        { title: "Overview", href: "/finance", icon: CreditCard, isNestedChild: true },
        { title: "Sales", href: "/finance/sales", icon: Receipt, isNestedChild: true },
        { title: "Purchases", href: "/inventory/purchases", icon: ShoppingCart, isNestedChild: true },
        { title: "Other Income", href: "/finance/other-income", icon: CreditCard, isNestedChild: true },
        { title: "Expenses", href: "/finance/expenses", icon: CreditCard, isNestedChild: true },
        { title: "Payments", href: "/finance/payments", icon: BadgeDollarSign, isNestedChild: true },
        { title: "Transactions", href: "/finance/transactions", icon: ArrowDownUp, isNestedChild: true },
      ];

      if (
        ([
          "finance.daybook.view",
          "finance.drawer.transfer.to_safe",
          "finance.cash.transfer.to_bank",
        ] as const).some((permission) => hasPermission(user, permission))
      ) {
        financeItems.splice(6, 0, {
          title: "Cash & Banks",
          href: "/finance/operations",
          icon: Banknote,
          isNestedChild: true,
        });
      }

      if (
        hasPermission(user, "day_close.drawer.open") &&
        !isExplicitlyLocked("finance.cash_drawer.enabled")
      ) {
        const cashBanksIndex = financeItems.findIndex((item) => item.href === "/finance/operations");
        financeItems.splice(cashBanksIndex >= 0 ? cashBanksIndex + 1 : financeItems.length, 0, {
          title: "Cash Drawers",
          href: "/cash-drawers",
          icon: Banknote,
          isNestedChild: true,
        });
      }

      if (
        hasPermission(user, "finance.daybook.view") &&
        !isExplicitlyLocked("finance.daybook.enabled")
      ) {
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
        [{ title: "Hotel PMS", href: "/hotel", icon: BedDouble, section: "Hotel" }],
        user,
      )[0];
      if (hotelItem && !result.some((item) => item.href === hotelItem.href)) {
        const dashboardIndex = result.findIndex((item) => item.href === "/dashboard");
        result.splice(dashboardIndex >= 0 ? dashboardIndex + 1 : 0, 0, hotelItem);
      }
    }

    // Clean up empty subItems arrays
    return result.map((r) => ({
      ...r,
      subItems: r.subItems?.length ? r.subItems : undefined,
    }));
  }, [currentSubscription, restaurant, user]);
}
