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
  Armchair,
  Calendar,
  Percent,
  MessageSquare,
  Zap,
  LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  normalizeRoles,
  getSidebarItemsForRoles,
} from "@/lib/role-permissions";

export interface SidebarItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

const ICON_MAP: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/orders/active": ClipboardList,
  "/orders/new": Plus,
  "/analytics": Activity,
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

export function useSidebarItems(): SidebarItem[] {
  const user = useAuth((state) => state.user);
  return useMemo(() => {
    const roles = normalizeRoles(user?.roles?.length ? user.roles : user?.role ? [user.role] : []);
    return getSidebarItemsForRoles(roles).map((item) => ({
      title: item.title,
      href: item.href,
      icon: ICON_MAP[item.href] ?? LayoutDashboard,
    }));
  }, [user?.roles, user?.role]);
}
