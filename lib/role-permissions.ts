// ─── Role-Based Access Control for Web Frontend ────────────────────────────
// Mirrors backend (permissions.py) and Flutter (role_permissions.dart + role_guard.dart)

export type UserRole =
  | "admin"
  | "manager"
  | "cashier"
  | "waiter"
  | "kitchen"
  | "bar"
  | "cafe"
  | "barista"
  | "user";

// ─── Role helpers ───────────────────────────────────────────────────────────

export function normalizeRole(role?: string | null): UserRole | null {
  if (!role) return null;
  const r = role.trim().toLowerCase();
  // Legacy "staff" maps to waiter
  if (r === "staff") return "waiter";
  const valid: UserRole[] = [
    "admin",
    "manager",
    "cashier",
    "waiter",
    "kitchen",
    "bar",
    "cafe",
    "barista",
    "user",
  ];
  return valid.includes(r as UserRole) ? (r as UserRole) : null;
}

/**
 * Normalizes a list of role strings to known UserRole values.
 * Custom role names (e.g. "Head Waiter") are dropped from the list — 
 * use `normalizeRolesWithFallback` when you also have a legacy role field.
 */
export function normalizeRoles(roles?: string[] | null): UserRole[] {
  if (!roles || roles.length === 0) return [];
  
  // Backend sometimes returns concatenated roles like "Waiter + Cashier + Rooms"
  const splitRoles = roles.flatMap(r => {
    if (!r) return [];
    return r.split(/[\+,\&]/).map(part => part.trim());
  });

  return splitRoles
    .map((r) => normalizeRole(r))
    .filter((r): r is UserRole => r !== null);
}

/**
 * Get normalized roles for a full user object.
 * Falls back to `user.role` (legacy field) if `user.roles` only contains
 * custom role names that don't map to known UserRole values.
 * This is critical for custom-role users where `roles: ["Head Waiter"]`
 * would otherwise produce an empty array.
 */
export function normalizeRolesForUser(
  user: { role?: string | null; roles?: string[] | null; primary_role?: string | null } | null
): UserRole[] {
  if (!user) return [];

  // Try normalizing all declared roles first
  const fromRoles = normalizeRoles(user.roles);
  if (fromRoles.length > 0) return fromRoles;

  // Fallback: use legacy role field (always a system role like "cashier")
  const fromLegacy = normalizeRole(user.role);
  if (fromLegacy) return [fromLegacy];

  // Fallback: use primary_role
  const fromPrimary = normalizeRole(user.primary_role);
  if (fromPrimary) return [fromPrimary];

  return [];
}

export const isAdmin = (r: UserRole | null) => r === "admin";
export const isManager = (r: UserRole | null) => r === "manager";
export const isCashier = (r: UserRole | null) => r === "cashier";
export const isWaiter = (r: UserRole | null) => r === "waiter";
export const isKitchen = (r: UserRole | null) =>
  r === "kitchen" || r === "bar";
export const isCafe = (r: UserRole | null) =>
  r === "cafe" || r === "barista";
export const isFunctional = (r: UserRole | null) =>
  isKitchen(r) || isCafe(r);

// Multi-role checks
export const hasAdmin = (roles: UserRole[]) => roles.includes("admin");
export const hasManager = (roles: UserRole[]) => roles.includes("manager");
export const hasAnyRole = (roles: UserRole[], targets: UserRole[]) =>
  targets.some((t) => roles.includes(t));

// ─── Granular Permissions (Backend-Driven) ──────────────────────────────────

export type PermissionKey =
  // Dashboard
  | "dashboard.view"
  // POS Module
  | "pos.view"
  | "pos.order.create"
  | "pos.order.edit"
  | "pos.order.void"
  | "pos.order.void_item"
  | "pos.order.transfer"
  | "pos.order.discount.apply"
  | "pos.order.discount.override"
  | "pos.order.serve_override"
  | "pos.quick_bill"
  | "pos.delivery"
  | "pos.pickup"
  // Billing Module
  | "billing.view"
  | "billing.payment.process"
  | "billing.payment.split"
  | "billing.refund.process"
  | "billing.refund.approve"
  | "billing.receipt.view"
  | "billing.receipt.print"
  // Tables & Reservation
  | "tables.view"
  | "tables.manage"
  | "tables.qr.manage"
  | "tables.reservation.view"
  | "tables.reservation.manage"
  // Hotel Module
  | "hotel.view"
  | "hotel.manage"
  | "hotel.checkin"
  | "hotel.checkout"
  | "hotel.folio.view"
  | "hotel.folio.edit"
  // Menu & Category
  | "menu.view"
  | "menu.manage"
  | "menu.items.manage"
  | "menu.categories.manage"
  | "menu.pricing.manage"
  // Inventory
  | "inventory.view"
  | "inventory.stock.manage"
  | "inventory.manage"
  | "inventory.suppliers.manage"
  | "inventory.recipes.manage"
  // Customers
  | "customers.view"
  | "customers.manage"
  | "customers.loyalty.manage"
  | "customers.credit.manage"
  // Reports & Day Close
  | "reports.daily.view"
  | "reports.dayclose.view"
  | "reports.dayclose.initiate"
  | "reports.dayclose.confirm"
  | "reports.dayclose.cancel"
  | "reports.dayclose.reopen"
  | "reports.dayclose.adjust.cash"
  | "reports.dayclose.adjust.financial"
  | "reports.dayclose.audit.view"
  | "reports.dayclose.export"
  | "reports.analytics.view"
  | "reports.periodic"
  | "reports.periodic.view"
  | "reports.periodic.confirm"
  | "reports.periodic.rebuild"
  | "reports.periodic.snapshot.view"
  | "reports.period.insights"
  | "reports.export"
  // Finance
  | "finance.income.view"
  | "finance.expenses.view"
  | "finance.expenses.manage"
  | "finance.expenses.approve"
  | "finance.payroll.view"
  | "finance.payroll.manage"
  // Admin & Settings
  | "admin.staff.view"
  | "admin.staff.manage"
  | "admin.roles.manage"
  | "admin.settings.manage"
  | "settings.manage_restaurant"
  // QR
  | "qr.manage"
  | "qr.print"
  // Stations
  | "station.kitchen.view"
  | "station.bar.view"
  | "station.cafe.view";

/**
 * Single permission gate for all analytics routes and APIs (Option A).
 * Admin role does NOT bypass this check — explicit permission required.
 */
export const ANALYTICS_VIEW_PERMISSION = "reports.analytics.view" as const;

/** Canonical keys used for page/sidebar gating (must match backend catalog). */
export const CANONICAL_ROUTE_GATES = {
  analytics: ANALYTICS_VIEW_PERMISSION,
  reservations: "tables.reservation.view",
  income: "finance.income.view",
  inventory: "inventory.view",
} as const satisfies Record<string, PermissionKey>;

function isAnalyticsGatedPath(pathname: string): boolean {
  return (
    pathname === "/analytics" ||
    pathname.startsWith("/analytics/") ||
    pathname === "/transactions" ||
    pathname.startsWith("/transactions/")
  );
}

/**
 * Permission check without admin role bypass.
 */
export function hasExplicitPermission(
  user: { permissions?: string[] } | null,
  permission: PermissionKey
): boolean {
  if (!user) return false;
  return user.permissions?.includes(permission) ?? false;
}

/** Analytics access — requires reports.analytics.view on the user, no admin bypass. */
export function hasAnalyticsViewPermission(
  user: { role?: string | null; roles?: string[] | null; permissions?: string[] } | null
): boolean {
  if (!user) return false;
  const perms = user.permissions ?? [];
  return (
    perms.includes(ANALYTICS_VIEW_PERMISSION) ||
    perms.includes("reports.analytics.drilldown")
  );
}

/**
 * Check if user has a specific permission.
 * Admins ALWAYS have all permissions (except analytics — use hasAnalyticsViewPermission).
 * Custom-role users are checked via their permissions array.
 */
export function hasPermission(
  user: { role?: string | null; roles?: string[] | null; permissions?: string[] } | null,
  permission: PermissionKey
): boolean {
  if (!user) return false;
  if (permission === ANALYTICS_VIEW_PERMISSION) {
    return hasAnalyticsViewPermission(user);
  }
  // Admin bypass — works for both legacy role field and roles array
  const roles = normalizeRolesForUser(user);
  if (roles.includes("admin")) return true;
  // Granular permission check (works for all custom-role users)
  return user.permissions?.includes(permission) ?? false;
}

// ─── Permission checks (match Flutter RolePermissions) ──────────────────────

export const canAccessSettings = (r: UserRole | null) =>
  isAdmin(r) || isManager(r);
export const canManageUsers = (r: UserRole | null) => isAdmin(r);
export const canManageMenu = (r: UserRole | null) =>
  isAdmin(r) || isManager(r);
export const canViewInventory = (r: UserRole | null) =>
  isAdmin(r) || isManager(r);
export const canManageInventory = (r: UserRole | null) =>
  isAdmin(r) || isManager(r);
export const canViewPayroll = (r: UserRole | null) =>
  isAdmin(r) || isCashier(r);
export const canManageExpenses = (r: UserRole | null) =>
  isAdmin(r) || isManager(r) || isCashier(r);
export const canViewIncome = (r: UserRole | null) =>
  isAdmin(r) || isManager(r) || isCashier(r);
export const canViewFinance = (r: UserRole | null) =>
  isAdmin(r) || isManager(r) || isCashier(r);
export function canManageHotelLayout(r: UserRole | null) {
  return isAdmin(r) || isManager(r);
}
export function canHandleCheckin(r: UserRole | null) {
  return isAdmin(r) || isManager(r) || isCashier(r);
}

// ─── Sidebar item visibility per role ───────────────────────────────────────
// Each key = sidebar href, value = set of roles that can see it.
// Matches Flutter role_guard.dart routeRoles + RestaurantHubScreen logic.

const ALL_DASHBOARD_ROLES: UserRole[] = [
  "admin",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
  "bar",
  "cafe",
  "barista",
];

const ORDER_ROLES: UserRole[] = ["admin", "manager", "cashier", "waiter"];
const ADMIN_SHELL_ROLES: UserRole[] = ["admin", "manager", "cashier"];
const ADMIN_MANAGER: UserRole[] = ["admin", "manager"];
const FINANCE_ROLES: UserRole[] = ["admin", "manager", "cashier"];
const KITCHEN_ROLES: UserRole[] = [
  "admin",
  "manager",
  "cashier",
  "kitchen",
  "bar",
];

export interface SidebarItemDef {
  title: string;
  href: string;
  allowedRoles: UserRole[];
  requiredPermission?: PermissionKey;
}

export const SIDEBAR_ROLE_MAP: SidebarItemDef[] = [
  // ── Admin/Manager/Cashier shell items (matches AdminDashboardShell) ──
  {
    title: "Dashboard",
    href: "/dashboard",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "dashboard.view",
  },
  {
    title: "Orders",
    href: "/orders/active",
    allowedRoles: ORDER_ROLES,
    requiredPermission: "pos.view",
  },
  {
    title: "New Order",
    href: "/orders/new",
    allowedRoles: ORDER_ROLES,
    requiredPermission: "pos.order.create",
  },
  {
    title: "Analytics",
    href: "/analytics",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "reports.analytics.view",
  },
  {
    title: "Day Close",
    href: "/day-close",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "reports.daily.view",
  },
  // ── Kitchen stations ──
  {
    title: "Kitchen",
    href: "/kitchen",
    allowedRoles: KITCHEN_ROLES,
    requiredPermission: "station.kitchen.view",
  },
  // ── Manage sub-items ──
  {
    title: "Menu",
    href: "/menu/items",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "menu.view",
  },
  {
    title: "Inventory",
    href: "/inventory",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "inventory.view",
  },
  {
    title: "Finance",
    href: "/finance/income",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "finance.income.view",
  },
  {
    title: "Transactions",
    href: "/transactions",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "reports.analytics.view",
  },
  {
    title: "Customers",
    href: "/customers",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "customers.view",
  },
  {
    title: "Tables",
    href: "/tables",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "tables.view",
  },
  {
    title: "Rooms",
    href: "/rooms",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "hotel.manage",
  },
  {
    title: "Reservations",
    href: "/reservations",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "tables.reservation.view",
  },
  {
    title: "Discounts",
    href: "/discounts",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "pos.order.discount.apply",
  },
  {
    title: "Manage",
    href: "/manage",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "admin.staff.view",
  },
  {
    title: "Feedback",
    href: "/feedback",
    allowedRoles: ALL_DASHBOARD_ROLES,
  },
];

export function getSidebarItemsForRole(role: UserRole | null) {
  if (!role) return [];
  return SIDEBAR_ROLE_MAP.filter((item) =>
    item.allowedRoles.includes(role)
  );
}

export function getSidebarItemsForRoles(
  roles: UserRole[],
  user?: { role?: string | null; roles?: string[] | null; permissions?: string[] } | null
) {
  return SIDEBAR_ROLE_MAP.filter((item) => {
    // ─── Key design principle ─────────────────────────────────────────────
    // If an item has a `requiredPermission`, that permission is the SOLE gate.
    // The `allowedRoles` list is IGNORED for permission-protected items.
    // This means: if an admin grants "menu.view" to a cashier via a custom role,
    // the cashier WILL see Menu in the sidebar — the ADMIN_MANAGER role restriction
    // is overridden by the explicit permission grant.
    // ─────────────────────────────────────────────────────────────────────
    if (item.requiredPermission) {
      return hasPermission(user || null, item.requiredPermission);
    }

    // Items WITHOUT a requiredPermission (e.g. Feedback) fall back to legacy role check.
    if (!roles.length) return false;
    return roles.some((role) => item.allowedRoles.includes(role));
  });
}

// ─── Route-level Permission ACL ─────────────────────────────────────────────

export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  // Core pages
  "/dashboard": "dashboard.view",
  "/analytics": "reports.analytics.view",
  "/day-close": "reports.daily.view",
  "/transactions": "reports.analytics.view",
  "/orders": "pos.view",
  "/kitchen": "station.kitchen.view",
  // Management
  "/menu": "menu.view",
  "/inventory": "inventory.view",
  "/tables": "tables.view",
  "/reservations": "tables.reservation.view",
  "/discounts": "pos.order.discount.apply",
  "/customers": "customers.view",
  "/rooms": "hotel.manage",
  // Finance
  "/finance": "finance.income.view",
  // Admin
  "/staff": "admin.staff.view",
  "/manage": "admin.staff.view",
};

// ─── Route-level ACL ────────────────────────────────────────────────────────
// Maps route prefixes to allowed roles. Used by RoleGuard component.

export const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/dashboard": ADMIN_SHELL_ROLES,
  "/orders": ORDER_ROLES,
  "/analytics": ADMIN_SHELL_ROLES,
  "/day-close": ADMIN_SHELL_ROLES,
  "/transactions": ADMIN_SHELL_ROLES,
  "/menu": ADMIN_MANAGER,
  "/kitchen": KITCHEN_ROLES,
  "/inventory": ADMIN_MANAGER,
  "/finance/income": ADMIN_SHELL_ROLES,
  "/finance/expenses": ADMIN_SHELL_ROLES,
  "/customers": ADMIN_SHELL_ROLES,
  "/tables": ADMIN_MANAGER,
  "/rooms": ["admin", "manager", "cashier", "waiter"],
  "/reservations": ADMIN_SHELL_ROLES,
  "/discounts": ADMIN_MANAGER,
  "/manage": ADMIN_MANAGER,
  "/manage/additional-settings": ADMIN_MANAGER,
  "/staff": ADMIN_MANAGER,
  "/payroll": ["admin", "cashier"],
  "/period-reports": ADMIN_MANAGER,
  "/settings": ALL_DASHBOARD_ROLES,
  "/feedback": ALL_DASHBOARD_ROLES,
  "/premium": ADMIN_MANAGER,
  "/welcome": ["user", ...ALL_DASHBOARD_ROLES],
};

export function isRouteAllowed(
  pathname: string,
  user: { role?: string | null; roles?: string[] | null; primary_role?: string | null; permissions?: string[] } | null
): boolean {
  if (!user) return false;

  // Analytics routes never bypass via admin role — explicit permission only
  if (isAnalyticsGatedPath(pathname)) {
    return hasAnalyticsViewPermission(user);
  }

  // Build the set of normalized legacy roles for this user
  const roles = normalizeRolesForUser(user);
  const isAdmin = roles.includes("admin");

  if (isAdmin) return true;

  // 1. Check Granular Permissions first (works for both legacy & custom-role users)
  const sortedPermissionPrefixes = Object.keys(ROUTE_PERMISSIONS).sort(
    (a, b) => b.length - a.length
  );
  for (const prefix of sortedPermissionPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      const required = ROUTE_PERMISSIONS[prefix];
      // If user has the required permission → they're allowed regardless of legacy role
      if (hasPermission(user, required)) return true;
      // If user does NOT have the required permission → deny immediately
      return false;
    }
  }

  // 2. No permission guard on this route — fall back to legacy role check
  if (!roles.length) return false;

  const sortedPrefixes = Object.keys(ROUTE_ROLES).sort(
    (a, b) => b.length - a.length
  );

  for (const prefix of sortedPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return roles.some(role => ROUTE_ROLES[prefix].includes(role));
    }
  }

  return false;
}

export function isRouteAllowedMulti(
  pathname: string,
  user: { role: string; roles?: string[]; primary_role?: string | null; permissions?: string[] } | null
): boolean {
  return isRouteAllowed(pathname, user);
}

/** Route guard helper for sidebar/manage links (strips query strings). */
export function isPathAccessible(
  href: string,
  user: { role?: string | null; roles?: string[] | null; primary_role?: string | null; permissions?: string[] } | null
): boolean {
  const path = href.split("?")[0];
  return isRouteAllowed(path, user);
}

/** Hotel sidebar href → permission key (matches ROUTE_PERMISSIONS where applicable). */
export const HOTEL_SIDEBAR_PERMISSIONS: Partial<Record<string, PermissionKey>> = {
  "/rooms": "hotel.manage",
  "/rooms/checkin": "hotel.manage",
  "/orders": "pos.view",
  "/orders/new": "pos.order.create",
  "/reservations": "tables.reservation.view",
  "/finance/income": "finance.income.view",
  "/customers": "customers.view",
  "/manage": "admin.staff.view",
  "/analytics": "reports.analytics.view",
};

export function filterSidebarLinksByAccess<
  T extends { href: string }
>(items: T[], user: Parameters<typeof isPathAccessible>[1]): T[] {
  return items.filter((item) => {
    const hotelPerm = HOTEL_SIDEBAR_PERMISSIONS[item.href];
    if (hotelPerm) {
      return hasPermission(user, hotelPerm);
    }
    return isPathAccessible(item.href, user);
  });
}

// ─── Default home route per role ────────────────────────────────────────────
// Where to redirect a user who tries to access a forbidden route.

export function getHomeRouteForRole(role: UserRole | null): string {
  switch (role) {
    case "admin":
    case "manager":
    case "cashier":
      return "/dashboard";
    case "waiter":
      return "/orders/active";
    case "kitchen":
    case "bar":
      return "/kitchen";
    case "cafe":
    case "barista":
      return "/kitchen";
    default:
      return "/";
  }
}

// Multi-role: pick the "highest privilege" home route
// Priority: admin/manager/cashier > waiter > kitchen/bar/cafe
export function getHomeRouteForRoles(roles: UserRole[]): string {
  if (!roles.length) return "/";
  if (hasAnyRole(roles, ["admin", "manager", "cashier"])) return "/dashboard";
  if (roles.includes("waiter")) return "/orders/active";
  if (hasAnyRole(roles, ["kitchen", "bar", "cafe", "barista"])) return "/kitchen";
  if (roles.includes("user")) return "/welcome";
  return "/";
}

/**
 * Get home route for a full user object.
 * Uses permissions as a fallback for custom-role users who have no
 * normalized legacy role but still have granular permissions.
 */
export function getHomeRouteForUser(
  user: { role?: string | null; roles?: string[] | null; primary_role?: string | null; permissions?: string[] } | null
): string {
  if (!user) return "/";

  const roles = normalizeRolesForUser(user);
  if (roles.length > 0) return getHomeRouteForRoles(roles);

  // Custom-role user with no recognized legacy role — use permissions to decide
  const perms = user.permissions || [];
  if (perms.includes("dashboard.view")) return "/dashboard";
  if (perms.includes("pos.view")) return "/orders/active";
  if (perms.includes("station.kitchen.view")) return "/kitchen";

  return "/dashboard"; // Sensible default for any authenticated custom-role user
}
