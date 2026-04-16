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
  | "barista";

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
  ];
  return valid.includes(r as UserRole) ? (r as UserRole) : null;
}

export function normalizeRoles(roles?: string[] | null): UserRole[] {
  if (!roles || roles.length === 0) return [];
  return roles
    .map((r) => normalizeRole(r))
    .filter((r): r is UserRole => r !== null);
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
  // Billing Module
  | "billing.view"
  | "billing.payment.process"
  | "billing.payment.split"
  | "billing.refund.process"
  | "billing.refund.approve"
  | "billing.receipt.print"
  // Tables & Reservation
  | "tables.view"
  | "tables.manage"
  | "tables.qr.manage"
  | "reservations.view"
  | "reservations.manage"
  // Hotel Module
  | "hotel.manage"
  | "hotel.checkin"
  | "hotel.checkout"
  // Menu & Category
  | "menu.view"
  | "menu.manage"
  | "menu.items.manage"
  // Inventory
  | "inventory.view"
  | "inventory.stock.manage"
  | "inventory.manage"
  // Customers
  | "customers.view"
  | "customers.manage"
  | "customers.loyalty.manage"
  | "customers.credit.manage"
  // Reports
  | "reports.daily"
  | "reports.analytics"
  // Finance
  | "finance.expenses.view"
  | "finance.expenses.manage"
  | "finance.expenses.approve"
  | "finance.payroll.view"
  | "finance.payroll.manage"
  | "finance.income_view"
  // Admin & Settings
  | "admin.staff.view"
  | "admin.staff.manage"
  | "admin.roles.manage"
  | "settings.manage_restaurant";

/**
 * Check if user has a specific permission.
 * Admins ALWAYS have all permissions.
 */
export function hasPermission(user: { role: string; permissions?: string[] } | null, permission: PermissionKey): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.permissions?.includes(permission) || false;
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
export const canViewAnalytics = (r: UserRole | null) =>
  isAdmin(r) || isManager(r) || isCashier(r);
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
    requiredPermission: "reports.daily", 
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
    requiredPermission: "reports.analytics",
  },
  {
    title: "Day Close",
    href: "/day-close",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "reports.daily",
  },
  // ── Kitchen (matches KitchenDashboardScreen) ──
  {
    title: "Kitchen",
    href: "/kitchen",
    allowedRoles: KITCHEN_ROLES,
    // Note: kitchen doesn't have a granular permission yet, 
    // but in reality POS users don't see it unless they are kitchen/bar staff.
  },
  // ── Manage sub-items (from RestaurantHubScreen, admin/manager only) ──
  {
    title: "Menu",
    href: "/menu/items",
    allowedRoles: ADMIN_MANAGER,
    // Add menu permission if we create one, for now role fallback
  },
  {
    title: "Inventory",
    href: "/inventory",
    allowedRoles: ADMIN_MANAGER,
  },
  {
    title: "Finance",
    href: "/finance/income",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "finance.income_view",
  },
  {
    title: "Transactions",
    href: "/transactions",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "reports.analytics",
  },
  {
    title: "Customers",
    href: "/customers",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "customers.view",
  },
  {
    title: "Tables",
    href: "/tables",
    allowedRoles: ADMIN_MANAGER,
    requiredPermission: "tables.view",
  },
  {
    title: "Rooms",
    href: "/rooms",
    allowedRoles: ["admin", "manager", "cashier", "waiter"],
    requiredPermission: "hotel.manage",
  },
  {
    title: "Reservations",
    href: "/reservations",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "reservations.view",
  },
  {
    title: "Discounts",
    href: "/discounts",
    allowedRoles: ADMIN_MANAGER,
    requiredPermission: "pos.order.discount.apply",
  },
  {
    title: "Manage",
    href: "/manage",
    allowedRoles: ADMIN_MANAGER,
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

export function getSidebarItemsForRoles(roles: UserRole[], user?: { role: string; permissions?: string[] } | null) {
  if (!roles.length) return [];
  return SIDEBAR_ROLE_MAP.filter((item) => {
    // 1. Check if ANY of the user's roles matches the item's allowedRoles
    const roleAllowed = roles.some((role) => item.allowedRoles.includes(role));
    if (!roleAllowed) return false;

    // 2. If item has a requiredPermission, check if user has it
    if (item.requiredPermission) {
      return hasPermission(user || null, item.requiredPermission);
    }

    return true;
  });
}

// ─── Route-level Permission ACL ─────────────────────────────────────────────

export const ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  "/dashboard": "reports.daily",
  "/analytics": "reports.analytics",
  "/day-close": "reports.daily",
  "/transactions": "reports.analytics",
  "/orders": "pos.view",
  "/rooms": "hotel.manage",
  "/staff": "admin.staff.view",
  "/manage": "admin.staff.view",
  "/finance": "finance.income_view",
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
};

export function isRouteAllowed(
  pathname: string,
  user: { role: string; permissions?: string[] } | null
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;

  const roles = normalizeRoles(user.role ? [user.role] : []);
  if (!roles.length) return false;

  // 1. Check Granular Permissions first
  const sortedPermissionPrefixes = Object.keys(ROUTE_PERMISSIONS).sort(
    (a, b) => b.length - a.length
  );
  for (const prefix of sortedPermissionPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      const required = ROUTE_PERMISSIONS[prefix];
      if (!hasPermission(user, required)) return false;
      break; // Found specific permission, now fall through to legacy role check if needed
    }
  }

  // 2. Legacy Role Check fallback
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
  user: { role: string; permissions?: string[] } | null
): boolean {
  return isRouteAllowed(pathname, user);
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
  return "/";
}
