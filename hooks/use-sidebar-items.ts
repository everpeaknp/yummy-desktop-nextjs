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
  Bed,
  BedDouble,
  KeyRound,
  BarChart3,
  Briefcase,
  LucideIcon,
  Layers,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  normalizeRolesForUser,
  getSidebarItemsForRoles,
  hasPermission,
  filterSidebarLinksByAccess,
} from "@/lib/role-permissions";
import { useRestaurant } from "@/hooks/use-restaurant";
export interface SidebarItem {
  title: string;
  href: string;
  icon: LucideIcon;
  section?: string; // optional group label
  externalUrl?: string;
  subItems?: SidebarItem[];
}

const RESTAURANT_ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/orders": ClipboardList,
  "/orders/active": ClipboardList,
  "/orders/history": ClipboardList,
  "/orders/new": Plus,
  "/analytics": Activity,
  "/day-close": Receipt,
  "/transactions": ArrowDownUp,
  "/menu/items": UtensilsCrossed,
  "/kitchen": ChefHat,
  "/inventory": Package,
  "/finance/income": CreditCard,
  "/customers": Users,
  "/tables": Armchair,
  "/reservations": Calendar,
  "/discounts": Percent,
  "/manage": Settings,
  "/feedback": MessageSquare,
  "/premium": Zap,
};

const HOTEL_SIDEBAR_BASE: SidebarItem[] = [
  { title: "Room Overview",   href: "/rooms",           icon: BedDouble,     section: "Hotel" },
  { title: "Orders",          href: "/orders",          icon: ClipboardList, section: "Hotel" },
  { title: "Order History",   href: "/orders/history",  icon: ClipboardList, section: "Hotel" },
  { title: "New Order",       href: "/orders/new",      icon: Plus,          section: "Hotel" },
  { title: "Check In/Out",    href: "/rooms/checkin",   icon: KeyRound,      section: "Hotel" },
  { title: "Reservations",    href: "/reservations",    icon: Calendar,      section: "Hotel" },
  { title: "Finance",         href: "/finance/income",  icon: CreditCard,    section: "Hotel" },
  { title: "Customers",       href: "/customers",       icon: Users,         section: "Hotel" },
  { title: "Manage",          href: "/manage",          icon: Settings,      section: "Hotel" },
];

function getHotelSidebarItems(
  user: { role?: string | null; roles?: string[] | null; permissions?: string[] } | null
): SidebarItem[] {
  const base = filterSidebarLinksByAccess(HOTEL_SIDEBAR_BASE, user);

  if (!hasPermission(user, "reports.analytics.view")) {
    return base;
  }

  const financeIndex = base.findIndex((item) => item.href === "/finance/income");
  if (financeIndex < 0) {
    return base;
  }

  const analyticsItem: SidebarItem = {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    section: "Hotel",
  };

  return [
    ...base.slice(0, financeIndex),
    analyticsItem,
    ...base.slice(financeIndex),
  ];
}

const HOTEL_CASHIER_ITEMS: SidebarItem[] = [
  { title: "Room Overview", href: "/rooms",          icon: BedDouble,     section: "Hotel" },
  { title: "Orders",        href: "/orders",         icon: ClipboardList, section: "Hotel" },
  { title: "Order History", href: "/orders/history", icon: ClipboardList, section: "Hotel" },
  { title: "New Order",     href: "/orders/new",     icon: Plus,          section: "Hotel" },
  { title: "Check In/Out", href: "/rooms/checkin",  icon: KeyRound,      section: "Hotel" },
  { title: "Finance",      href: "/finance/income", icon: CreditCard,    section: "Hotel" },
  { title: "Customers",    href: "/customers",      icon: Users,         section: "Hotel" },
];

export function useSidebarItems(): SidebarItem[] {
  const user = useAuth((state) => state.user);
  const restaurant = useRestaurant((s) => s.restaurant);
  const selectedModule = useRestaurant((s) => s.selectedModule);

  return useMemo(() => {
    const roles = normalizeRolesForUser(user);
    const isAdminOrManager = roles.some(r => r === "admin" || r === "manager");
    const isCashier = roles.some(r => r === "cashier");

    // --- HOTEL MODE ---
    if (selectedModule === "hotel" && restaurant?.hotel_enabled) {
      if (isAdminOrManager) return getHotelSidebarItems(user);
      if (isCashier) return filterSidebarLinksByAccess(HOTEL_CASHIER_ITEMS, user);
      // Other staff in hotel mode see basic view
      return [{ title: "Room Overview", href: "/rooms", icon: BedDouble }];
    }

    // --- RESTAURANT MODE (or single-module restaurant) ---
    const restaurantOnlyItems = ["/orders", "/orders/new", "/kitchen", "/tables", "/reservations"];
    const hotelOnlyHrefs = ["/rooms"];

    const flatItems = getSidebarItemsForRoles(roles, user)
      .filter((item) => {
        // Remove Feedback from sidebar entirely (it is accessed via profile dropdown)
        if (item.href === "/feedback") return false;
        // Never show hotel-only items in restaurant mode
        if (hotelOnlyHrefs.includes(item.href)) return false;
        // If restaurant not enabled, don't show restaurant-specific items
        if (!restaurant?.restaurant_enabled && restaurantOnlyItems.includes(item.href)) return false;
        return true;
      })
      .map((item) => ({
        title: item.title,
        href: item.href,
        icon: RESTAURANT_ICON_MAP[item.href] ?? LayoutDashboard,
        externalUrl: item.externalUrl,
      }));

    // Grouping logic for premium aesthetic
    const groups: { [key: string]: SidebarItem } = {};
    const result: SidebarItem[] = [];

    const getGroup = (id: string, title: string, icon: LucideIcon, href: string) => {
      if (!groups[id]) {
        groups[id] = { title, href, icon, subItems: [] };
        result.push(groups[id]);
      }
      return groups[id];
    };

    flatItems.forEach((item) => {
      if (["/orders", "/orders/history", "/orders/new"].includes(item.href)) {
        const group = getGroup("orders", "Orders", ClipboardList, "/orders");
        if (item.href !== "/orders") group.subItems!.push(item);
      } else if (["/menu/items", "/menu/categories", "/menu/modifiers"].includes(item.href)) {
        const group = getGroup("menu", "Menu", UtensilsCrossed, "/menu/items");
        if (item.href !== "/menu/items") group.subItems!.push(item);
      } else if (["/tables", "/reservations"].includes(item.href)) {
        const group = getGroup("tables", "Table & Space", Armchair, "/tables");
        group.subItems!.push(item);
      } else if (["/kitchen", "/discounts"].includes(item.href)) {
        const group = getGroup("services", "Services", ChefHat, item.href === "/kitchen" ? "/kitchen" : item.href);
        group.subItems!.push(item);
      } else if (["/finance/income", "/finance/expenses", "/transactions", "/day-close", "/payroll"].includes(item.href)) {
        const group = getGroup("finance", "Finance", CreditCard, "/finance/income");
        group.subItems!.push(item);
      } else if (["/manage", "/settings"].includes(item.href)) {
        const group = getGroup("settings", "Settings", Settings, "/manage");
        if (item.href !== "/manage") group.subItems!.push(item);
      } else if (["/inventory", "/manage/suppliers"].includes(item.href)) {
        const group = getGroup("inventory", "Inventory", Package, "/inventory");
        if (item.href !== "/inventory") group.subItems!.push(item);
      } else {
        result.push(item);
      }
    });

    // Clean up empty subItems arrays
    return result.map(r => ({
      ...r,
      subItems: r.subItems?.length ? r.subItems : undefined
    }));
  }, [user?.roles, user?.role, user?.primary_role, user?.permissions, restaurant?.hotel_enabled, restaurant?.restaurant_enabled, selectedModule]);
}
