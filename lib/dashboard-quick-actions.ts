import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Calendar,
  ChefHat,
  ClipboardList,
  Plus,
  Receipt,
  Zap,
} from "lucide-react";

/** Map Flutter / legacy API routes to Next.js app routes. */
const ROUTE_ALIASES: Record<string, string> = {
  "/orders/create": "/orders/new",
  "/order-channel-selection": "/orders/new",
  "/running-orders": "/orders",
  "/orders/active": "/orders",
  "/order-history": "/orders?tab=history",
  "/kot-management": "/kitchen",
  "/kot": "/kitchen",
};

const ROUTE_BY_KEY: Record<string, string> = {
  create_order: "/orders/new",
  running_orders: "/orders",
  kot: "/kitchen",
  tables: "/tables",
  reservations: "/reservations",
  day_close: "/day-close",
};

/** Attention item types from dashboard v2 API. */
const ATTENTION_TYPE_ROUTES: Record<string, string> = {
  KOT_DELAY: "/kitchen",
  ORDER_AGING: "/orders",
  STALE_OPEN_ORDERS: "/orders",
  REFUND_ACTIVITY: "/orders?tab=history",
  HIGH_CANCELLATION: "/orders?tab=history",
  OUTSTANDING_RECEIVABLES: "/customers",
  RESERVATIONS_TODAY: "/reservations",
  DAY_CLOSE: "/day-close",
};

const ORDER_DETAIL_ATTENTION_TYPES = new Set(["ORDER_AGING", "STALE_OPEN_ORDERS"]);

export type DashboardRouteOptions = {
  /** Quick action key or attention item type. */
  key?: string;
  entityId?: number | null;
};

export function resolveDashboardRoute(route: string, options: DashboardRouteOptions = {}): string {
  const normalizedKey = options.key?.trim().toUpperCase();
  const entityId = options.entityId;

  if (normalizedKey && ROUTE_BY_KEY[normalizedKey.toLowerCase()]) {
    return ROUTE_BY_KEY[normalizedKey.toLowerCase()];
  }

  if (normalizedKey && ATTENTION_TYPE_ROUTES[normalizedKey]) {
    const typeRoute = ATTENTION_TYPE_ROUTES[normalizedKey];
    if (
      entityId != null &&
      entityId > 0 &&
      normalizedKey &&
      ORDER_DETAIL_ATTENTION_TYPES.has(normalizedKey)
    ) {
      return `/orders/${entityId}`;
    }
    return typeRoute;
  }

  const trimmedRoute = route.trim();
  if (ROUTE_ALIASES[trimmedRoute]) {
    const mapped = ROUTE_ALIASES[trimmedRoute];
    if (
      entityId != null &&
      entityId > 0 &&
      (mapped === "/orders" || trimmedRoute === "/running-orders")
    ) {
      return `/orders/${entityId}`;
    }
    return mapped;
  }

  return trimmedRoute || "/dashboard";
}

export function resolveQuickActionRoute(key: string, route: string): string {
  return resolveDashboardRoute(route, { key });
}

const ICON_BY_KEY: Record<string, LucideIcon> = {
  create_order: Plus,
  running_orders: ClipboardList,
  kot: ChefHat,
  tables: Armchair,
  reservations: Calendar,
  day_close: Receipt,
};

/** Material / Flutter icon names from dashboard v2 API. */
const ICON_BY_BACKEND_NAME: Record<string, LucideIcon> = {
  receipt_long: Plus,
  receipt: ClipboardList,
  restaurant: ChefHat,
  table_restaurant: Armchair,
  event_available: Calendar,
  payments: Receipt,
};

const ICON_BY_TITLE: Record<string, LucideIcon> = {
  "new order": Plus,
  "create order": Plus,
  "running orders": ClipboardList,
  orders: ClipboardList,
  kot: ChefHat,
  kitchen: ChefHat,
  tables: Armchair,
  reservations: Calendar,
  "day close": Receipt,
};

export function resolveQuickActionIcon(
  key: string,
  icon?: string | null,
  title?: string
): LucideIcon {
  const normalizedKey = key.trim().toLowerCase();
  if (ICON_BY_KEY[normalizedKey]) return ICON_BY_KEY[normalizedKey];

  const iconName = icon?.trim().toLowerCase();
  if (iconName && ICON_BY_BACKEND_NAME[iconName]) {
    return ICON_BY_BACKEND_NAME[iconName];
  }

  const titleKey = title?.trim().toLowerCase();
  if (titleKey && ICON_BY_TITLE[titleKey]) return ICON_BY_TITLE[titleKey];

  return Zap;
}
