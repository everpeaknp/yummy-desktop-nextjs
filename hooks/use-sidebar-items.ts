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
  normalizeRoles,
  getSidebarItemsForRoles,
} from "@/lib/role-permissions";
import { useRestaurant } from "@/hooks/use-restaurant";

export interface SidebarItem {
  title: string;
  href: string;
  icon: LucideIcon;
  section?: string; // optional group label
}

const RESTAURANT_ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/orders": ClipboardList,
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

// Hotel-specific sidebar items (always shown for admin/manager in hotel mode)
const HOTEL_SIDEBAR_ITEMS: SidebarItem[] = [
  { title: "Overview",        href: "/rooms",           icon: BedDouble,     section: "Hotel" },
  { title: "Orders",          href: "/orders",   icon: ClipboardList, section: "Hotel" },
  { title: "New Order",       href: "/orders/new",      icon: Plus,          section: "Hotel" },
  { title: "Check In/Out",    href: "/rooms/checkin",   icon: KeyRound,      section: "Hotel" },
  { title: "Reservations",    href: "/reservations",    icon: Calendar,      section: "Hotel" },
  { title: "Analytics",       href: "/analytics",       icon: BarChart3,     section: "Hotel" },
  { title: "Finance",         href: "/finance/income",  icon: CreditCard,    section: "Hotel" },
  { title: "Customers",       href: "/customers",       icon: Users,         section: "Hotel" },
  { title: "Manage",          href: "/manage",          icon: Settings,      section: "Hotel" },
];

const HOTEL_CASHIER_ITEMS: SidebarItem[] = [
  { title: "Overview",     href: "/rooms",          icon: BedDouble,     section: "Hotel" },
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
    const roles = normalizeRoles(user?.roles?.length ? user.roles : user?.role ? [user.role] : []);
    const isAdminOrManager = roles.some(r => r === "admin" || r === "manager");
    const isCashier = roles.some(r => r === "cashier");

    // --- HOTEL MODE ---
    if (selectedModule === "hotel" && restaurant?.hotel_enabled) {
      if (isAdminOrManager) return HOTEL_SIDEBAR_ITEMS;
      if (isCashier) return HOTEL_CASHIER_ITEMS;
      // Other staff in hotel mode see basic view
      return [{ title: "Rooms", href: "/rooms", icon: Bed }];
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
      }));
  }, [user?.roles, user?.role, restaurant?.hotel_enabled, restaurant?.restaurant_enabled, selectedModule]);
}
