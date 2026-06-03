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
}

const RESTAURANT_ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/orders": ClipboardList,
  "/orders/active": ClipboardList,
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
  { title: "Orders",       href: "/orders",  icon: ClipboardList, section: "Hotel" },
  { title: "New Order",    href: "/orders/new",     icon: Plus,          section: "Hotel" },
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

    return getSidebarItemsForRoles(roles, user)
      .filter((item) => {
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
  }, [user?.roles, user?.role, user?.primary_role, user?.permissions, restaurant?.hotel_enabled, restaurant?.restaurant_enabled, selectedModule]);
}
