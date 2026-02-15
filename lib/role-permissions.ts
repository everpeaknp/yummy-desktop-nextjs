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
}

export const SIDEBAR_ROLE_MAP: SidebarItemDef[] = [
  // ── Admin/Manager/Cashier shell items (matches AdminDashboardShell) ──
  {
    title: "Dashboard",
    href: "/dashboard",
    allowedRoles: ADMIN_SHELL_ROLES,
  },
  {
    title: "Orders",
    href: "/orders/active",
    allowedRoles: ORDER_ROLES,
  },
  {
    title: "New Order",
    href: "/orders/new",
    allowedRoles: ORDER_ROLES,
  },
  {
    title: "Analytics",
    href: "/analytics",
    allowedRoles: ADMIN_SHELL_ROLES,
  },
  // ── Kitchen (matches KitchenDashboardScreen) ──
  {
    title: "Kitchen",
    href: "/kitchen",
    allowedRoles: KITCHEN_ROLES,
  },
  // ── Manage sub-items (from RestaurantHubScreen, admin/manager only) ──
  {
    title: "Menu",
    href: "/menu/items",
    allowedRoles: ADMIN_MANAGER,
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
  },
  {
    title: "Customers",
    href: "/customers",
    allowedRoles: ADMIN_SHELL_ROLES,
  },
  {
    title: "Tables",
    href: "/tables",
    allowedRoles: ADMIN_MANAGER,
  },
  {
    title: "Reservations",
    href: "/reservations",
    allowedRoles: ADMIN_SHELL_ROLES,
  },
  {
    title: "Discounts",
    href: "/discounts",
    allowedRoles: ADMIN_MANAGER,
  },
  {
    title: "Manage",
    href: "/manage",
    allowedRoles: ADMIN_MANAGER,
  },
];

export function getSidebarItemsForRole(role: UserRole | null) {
  if (!role) return [];
  return SIDEBAR_ROLE_MAP.filter((item) =>
    item.allowedRoles.includes(role)
  );
}

export function getSidebarItemsForRoles(roles: UserRole[]) {
  if (!roles.length) return [];
  // Union: show item if ANY of the user's roles is in allowedRoles
  return SIDEBAR_ROLE_MAP.filter((item) =>
    roles.some((role) => item.allowedRoles.includes(role))
  );
}

// ─── Route-level ACL ────────────────────────────────────────────────────────
// Maps route prefixes to allowed roles. Used by RoleGuard component.

export const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/dashboard": ADMIN_SHELL_ROLES,
  "/orders": ORDER_ROLES,
  "/analytics": ADMIN_SHELL_ROLES,
  "/menu": ADMIN_MANAGER,
  "/kitchen": KITCHEN_ROLES,
  "/inventory": ADMIN_MANAGER,
  "/finance/income": ADMIN_SHELL_ROLES,
  "/finance/expenses": ADMIN_SHELL_ROLES,
  "/customers": ADMIN_SHELL_ROLES,
  "/tables": ADMIN_MANAGER,
  "/reservations": ADMIN_SHELL_ROLES,
  "/discounts": ADMIN_MANAGER,
  "/manage": ADMIN_MANAGER,
  "/manage/additional-settings": ADMIN_MANAGER,
  "/staff": ADMIN_MANAGER,
  "/payroll": ["admin", "cashier"],
  "/period-reports": ADMIN_MANAGER,
  "/settings": ALL_DASHBOARD_ROLES,
};

export function isRouteAllowed(
  pathname: string,
  role: UserRole | null
): boolean {
  if (!role) return false;
  if (role === "admin") return true;

  const sortedPrefixes = Object.keys(ROUTE_ROLES).sort(
    (a, b) => b.length - a.length
  );

  for (const prefix of sortedPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return ROUTE_ROLES[prefix].includes(role);
    }
  }

  return false;
}

export function isRouteAllowedMulti(
  pathname: string,
  roles: UserRole[]
): boolean {
  if (!roles.length) return false;
  // If ANY role grants access, allow
  return roles.some((role) => isRouteAllowed(pathname, role));
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
