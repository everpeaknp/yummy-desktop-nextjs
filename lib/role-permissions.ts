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
  // Per-user permission bags are not identity roles (e.g. __user_12__).
  if (r.startsWith("__user_") || r.startsWith("__platform_user_")) return null;
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
  const splitRoles = roles.flatMap((r) => {
    if (!r) return [];
    return r.split(/[\+,\&]/).map((part) => part.trim());
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
  user: {
    role?: string | null;
    roles?: string[] | null;
    primary_role?: string | null;
  } | null,
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
export const isKitchen = (r: UserRole | null) => r === "kitchen" || r === "bar";
export const isCafe = (r: UserRole | null) => r === "cafe" || r === "barista";
export const isFunctional = (r: UserRole | null) => isKitchen(r) || isCafe(r);

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
  | "pos.order.discount.override_limit"
  | "pos.order.serve_override"
  | "pos.order.nc.mark"
  | "pos.quick_bill"
  | "pos.delivery"
  | "pos.pickup"
  // Billing Module
  | "billing.view"
  | "billing.bill.split"
  | "billing.payment.process"
  | "billing.payment.edit"
  | "billing.payment.delete"
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
  | "hotel.early_departure.override"
  | "hotel.folio.view"
  | "hotel.folio.edit"
  | "hotel.folio.override"
  | "hotel.bookings.manage"
  | "hotel.inventory.manage"
  | "hotel.housekeeping.view"
  | "hotel.housekeeping.manage"
  | "hotel.rates.manage"
  | "hotel.night_audit.run"
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
  | "inventory.items.manage"
  | "inventory.stock.add"
  | "inventory.stock.reduce"
  | "inventory.purchases.post"
  | "inventory.purchases.void"
  | "inventory.purchase_returns.create"
  | "inventory.purchase_returns.override_limit"
  | "inventory.stations.view"
  | "inventory.stations.manage"
  | "inventory.suppliers.manage"
  | "inventory.recipes.manage"
  | "inventory.consume"
  | "inventory.negative_stock.override"
  | "inventory.accounting.view"
  | "inventory.accounting.manage"
  // Customers
  | "customers.view"
  | "customers.manage"
  | "customers.loyalty.manage"
  | "customers.credit.manage"
  // Yummy Grow
  | "grow.view"
  | "grow.campaigns.manage"
  | "grow.campaigns.approve"
  | "grow.campaigns.send"
  | "grow.settings.manage"
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
  | "reports.analytics.drilldown"
  | "day_close.drawer.open"
  | "day_close.drawer.count"
  | "day_close.drawer.approve"
  | "day_close.drawer.reopen"
  | "day_close.drawer.configure"
  | "reports.periodic"
  | "reports.periodic.view"
  | "reports.periodic.confirm"
  | "reports.periodic.rebuild"
  | "reports.periodic.snapshot.view"
  | "reports.period.insights"
  | "reports.export"
  // Finance
  | "finance.income.view"
  | "finance.drawer.open.own"
  | "finance.drawer.open.any"
  | "finance.drawer.assign"
  | "finance.drawer.close.own"
  | "finance.drawer.close.any"
  | "finance.drawer.expense.create"
  | "finance.drawer.expense.approve"
  | "finance.drawer.transfer.to_safe"
  | "finance.cash.safe.disburse"
  | "finance.cash.transfer.to_bank"
  | "finance.bank_deposit.confirm"
  | "finance.variance.approve"
  | "finance.daybook.view"
  | "finance.ledger.view"
  | "finance.coa.view"
  | "finance.coa.manage"
  | "finance.coa.group.manage"
  | "finance.coa.opening_balances.manage"
  | "finance.sales.view"
  | "finance.sales.create"
  | "finance.sales.return"
  | "finance.journal.view"
  | "finance.journal.manage"
  | "finance.journal.reverse"
  | "finance.mapping.manage"
  | "finance.accounting.adjust"
  | "finance.payment_instruments.manage"
  | "finance.payment_settlements.manage"
  | "finance.accounting.view"
  | "finance.accounting.setup"
  | "finance.accounting.opening_balances.manage"
  | "finance.accounting.vouchers.create"
  | "finance.accounting.vouchers.approve"
  | "finance.accounting.vouchers.post"
  | "finance.accounting.vouchers.reverse"
  | "finance.accounting.periods.close"
  | "finance.accounting.periods.lock"
  | "finance.accounting.periods.reopen"
  | "finance.accounting.settlements.manage"
  | "finance.accounting.vat.export"
  | "finance.accounting.override_locked_period"
  | "finance.ledger.backfill"
  | "finance.expenses.view"
  | "finance.expenses.manage"
  | "finance.expenses.approve"
  | "finance.payroll.view"
  | "finance.payroll.manage"
  | "finance.reports.sales.view"
  | "finance.reports.invoices.view"
  | "finance.reports.payments.view"
  | "finance.reports.tax.view"
  // Admin & Settings (staff financial ledger)
  | "admin.staff.credit.manage"
  // Attendance
  | "attendance.view"
  | "attendance.clock"
  | "attendance.manage"
  | "attendance.device.manage"
  | "attendance.payroll.export"
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
  | "station.cafe.view"
  // Canonical backend permissions not previously represented in frontend types
  | "inventory.items.manage"
  | "inventory.stock.add"
  | "inventory.stock.reduce"
  | "inventory.purchases.post"
  | "inventory.purchases.void"
  | "inventory.purchase_returns.create"
  | "inventory.purchase_returns.override_limit"
  | "inventory.stations.view"
  | "inventory.stations.manage"
  | "billing.bill.split"
  | "attendance.clock"
  | "reports.analytics.drilldown"
  | "pos.order.discount.override_limit"
  // Platform permissions are typed for parity but do not grant tenant access.
  | "platform.restaurants.view"
  | "platform.restaurants.manage"
  | "platform.leads.view"
  | "platform.leads.manage"
  | "platform.staff.view"
  | "platform.staff.manage"
  | "platform.roles.manage"
  | "platform.billing.manage"
  | "platform.billing.view"
  | "platform.billing.catalog.manage"
  | "platform.billing.publish"
  | "platform.billing.subscriptions.manage"
  | "platform.billing.overrides.manage"
  | "platform.billing.payments.manage"
  | "platform.billing.audit.view";

// The API returns assigned permission keys. Match the backend's implication
// graph locally so manage grants expose the same dependent screens/actions.
const PERMISSION_IMPLICATIONS: Partial<Record<PermissionKey, PermissionKey[]>> = {
  "platform.billing.manage": [
    "platform.billing.view",
    "platform.billing.catalog.manage",
    "platform.billing.publish",
    "platform.billing.subscriptions.manage",
    "platform.billing.overrides.manage",
    "platform.billing.payments.manage",
    "platform.billing.audit.view",
  ],
  "hotel.manage": [
    "hotel.view", "hotel.checkin", "hotel.checkout", "hotel.early_departure.override",
    "hotel.folio.view", "hotel.folio.edit", "hotel.folio.override", "hotel.bookings.manage",
    "hotel.inventory.manage", "hotel.housekeeping.view", "hotel.housekeeping.manage",
    "hotel.rates.manage", "hotel.night_audit.run",
  ],
  "hotel.housekeeping.manage": ["hotel.housekeeping.view"],
  "tables.reservation.manage": ["tables.reservation.view"],
  "qr.manage": ["qr.print"],
  "tables.manage": ["qr.manage", "qr.print"],
  "inventory.stock.manage": [
    "inventory.suppliers.manage", "inventory.items.manage", "inventory.stock.add",
    "inventory.stock.reduce", "inventory.purchases.post", "inventory.purchases.void",
    "inventory.purchase_returns.create", "inventory.purchase_returns.override_limit",
    "inventory.stations.manage",
  ],
  "inventory.stations.manage": ["inventory.stations.view"],
  "inventory.consume": ["inventory.stock.reduce"],
  "finance.drawer.open.any": ["finance.drawer.open.own"],
  "finance.drawer.close.any": ["finance.drawer.close.own"],
  "day_close.drawer.open": ["finance.drawer.open.own"],
  "day_close.drawer.count": ["finance.drawer.close.own"],
  "day_close.drawer.approve": [
    "finance.drawer.open.any", "finance.drawer.close.any", "finance.drawer.transfer.to_safe",
  ],
  "finance.coa.manage": ["finance.coa.view"],
  "finance.coa.group.manage": ["finance.coa.manage", "finance.coa.view"],
  "finance.coa.opening_balances.manage": ["finance.coa.manage", "finance.coa.view"],
  "finance.sales.create": ["finance.sales.view"],
  "finance.sales.return": ["finance.sales.view"],
  "finance.journal.manage": ["finance.journal.view"],
  "finance.journal.reverse": ["finance.journal.manage", "finance.journal.view"],
  "finance.accounting.setup": [
    "finance.coa.manage", "finance.coa.view", "finance.coa.group.manage",
    "finance.coa.opening_balances.manage", "finance.mapping.manage",
  ],
  "finance.accounting.settlements.manage": [
    "finance.payment_instruments.manage", "finance.payment_settlements.manage",
    "finance.cash.transfer.to_bank", "finance.bank_deposit.confirm",
  ],
};

const KNOWN_PERMISSION_KEYS = new Set<PermissionKey>([
  "dashboard.view", "pos.view", "pos.order.create", "pos.order.edit", "pos.order.void",
  "pos.order.void_item", "pos.order.transfer", "pos.order.discount.apply",
  "pos.order.discount.override", "pos.order.discount.override_limit", "pos.order.serve_override",
  "pos.order.nc.mark", "pos.quick_bill", "pos.delivery", "pos.pickup", "billing.view",
  "billing.bill.split", "billing.payment.process", "billing.payment.edit", "billing.payment.delete",
  "billing.payment.split", "billing.refund.process", "billing.refund.approve", "billing.receipt.view",
  "billing.receipt.print", "menu.view", "menu.items.manage", "menu.categories.manage",
  "menu.pricing.manage", "tables.view", "tables.manage", "tables.reservation.view",
  "tables.reservation.manage", "hotel.view", "hotel.manage", "hotel.checkin", "hotel.checkout",
  "hotel.early_departure.override", "hotel.folio.view", "hotel.folio.edit", "hotel.folio.override",
  "hotel.bookings.manage", "hotel.inventory.manage", "hotel.housekeeping.view",
  "hotel.housekeeping.manage", "hotel.rates.manage", "hotel.night_audit.run", "inventory.view",
  "inventory.stock.manage", "inventory.manage", "inventory.items.manage", "inventory.stock.add",
  "inventory.stock.reduce", "inventory.purchases.post", "inventory.purchases.void",
  "inventory.purchase_returns.create", "inventory.purchase_returns.override_limit",
  "inventory.stations.view", "inventory.stations.manage", "inventory.suppliers.manage",
  "inventory.recipes.manage", "inventory.consume", "inventory.negative_stock.override",
  "inventory.accounting.view", "inventory.accounting.manage", "customers.view", "customers.manage",
  "customers.loyalty.manage", "customers.credit.manage", "reports.daily.view", "reports.dayclose.view",
  "reports.dayclose.initiate", "reports.dayclose.confirm", "reports.dayclose.cancel",
  "reports.dayclose.reopen", "reports.dayclose.adjust.cash", "reports.dayclose.adjust.financial",
  "reports.dayclose.audit.view", "reports.dayclose.export", "reports.analytics.view",
  "reports.analytics.drilldown", "reports.periodic", "reports.periodic.view", "reports.periodic.confirm",
  "reports.periodic.rebuild", "reports.periodic.snapshot.view", "reports.period.insights", "reports.export",
  "day_close.drawer.open", "day_close.drawer.count", "day_close.drawer.approve", "day_close.drawer.reopen",
  "finance.income.view", "finance.drawer.open.own", "finance.drawer.open.any", "finance.drawer.assign",
  "finance.drawer.close.own", "finance.drawer.close.any", "finance.drawer.expense.create",
  "finance.drawer.expense.approve", "finance.drawer.transfer.to_safe", "finance.cash.safe.disburse",
  "finance.cash.transfer.to_bank", "finance.bank_deposit.confirm", "finance.variance.approve",
  "finance.daybook.view", "finance.ledger.view", "finance.coa.view", "finance.coa.manage",
  "finance.coa.group.manage", "finance.coa.opening_balances.manage", "finance.sales.view",
  "finance.sales.create", "finance.sales.return", "finance.journal.view", "finance.journal.manage",
  "finance.journal.reverse", "finance.mapping.manage", "finance.accounting.adjust",
  "finance.payment_instruments.manage", "finance.payment_settlements.manage", "finance.accounting.view",
  "finance.accounting.setup", "finance.accounting.opening_balances.manage", "finance.accounting.vouchers.create",
  "finance.accounting.vouchers.approve", "finance.accounting.vouchers.post", "finance.accounting.vouchers.reverse",
  "finance.accounting.periods.close", "finance.accounting.periods.lock", "finance.accounting.periods.reopen",
  "finance.accounting.settlements.manage", "finance.accounting.vat.export", "finance.accounting.override_locked_period",
  "finance.ledger.backfill", "finance.expenses.view", "finance.expenses.manage", "finance.expenses.approve",
  "finance.payroll.view", "finance.payroll.manage", "finance.reports.sales.view", "finance.reports.invoices.view",
  "finance.reports.payments.view", "finance.reports.tax.view", "admin.staff.credit.manage", "attendance.clock",
  "attendance.view", "attendance.manage", "attendance.device.manage", "attendance.payroll.export",
  "admin.staff.view", "admin.staff.manage", "admin.roles.manage", "admin.settings.manage",
  "settings.manage_restaurant", "qr.manage", "qr.print", "station.kitchen.view", "station.bar.view",
  "station.cafe.view", "platform.restaurants.view", "platform.restaurants.manage", "platform.leads.view",
  "platform.leads.manage", "platform.staff.view", "platform.staff.manage", "platform.roles.manage",
  "platform.billing.manage", "platform.billing.view", "platform.billing.catalog.manage", "platform.billing.publish",
  "platform.billing.subscriptions.manage", "platform.billing.overrides.manage", "platform.billing.payments.manage",
  "platform.billing.audit.view",
]);

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
  accounting: "finance.accounting.view",
  inventory: "inventory.view",
  grow: "grow.view",
} as const satisfies Record<string, PermissionKey>;

function isAnalyticsGatedPath(pathname: string): boolean {
  return pathname === "/analytics" || pathname.startsWith("/analytics/");
}

/**
 * Permission check without admin role bypass.
 */
export function hasExplicitPermission(
  user: { permissions?: string[] } | null,
  permission: PermissionKey,
): boolean {
  if (!user) return false;
  return user.permissions?.includes(permission) ?? false;
}

/**
 * Analytics access.
 * Admin/manager shell users should not lose the route or sidebar during
 * transient auth/profile races; custom-role users still require the explicit
 * analytics permission.
 */
export function hasAnalyticsViewPermission(
  user: {
    role?: string | null;
    roles?: string[] | null;
    permissions?: string[];
  } | null,
): boolean {
  if (!user) return false;
  const roles = normalizeRolesForUser(user);
  if (roles.includes("admin")) {
    return true;
  }
  const perms = user.permissions ?? [];
  return perms.includes(ANALYTICS_VIEW_PERMISSION);
}

/**
 * Check if user has a specific permission.
 * Admins ALWAYS have all permissions (except analytics — use hasAnalyticsViewPermission).
 * Custom-role users are checked via their permissions array.
 */
export function hasPermission(
  user: {
    role?: string | null;
    roles?: string[] | null;
    permissions?: string[];
  } | null,
  permission: PermissionKey,
): boolean {
  if (!user) return false;
  if (permission === ANALYTICS_VIEW_PERMISSION) {
    return hasAnalyticsViewPermission(user);
  }
  // Tenant administrators bypass restaurant permissions only. Platform
  // privileges are independent and never imply tenant data access.
  const roles = normalizeRolesForUser(user);
  const permissions = user.permissions ?? [];
  if (permission.startsWith("platform.")) {
    const effectivePlatform = new Set<PermissionKey>();
    const pending = permissions.filter(
      (key): key is PermissionKey =>
        key.startsWith("platform.") &&
        KNOWN_PERMISSION_KEYS.has(key as PermissionKey),
    );
    while (pending.length) {
      const current = pending.pop()!;
      if (effectivePlatform.has(current)) continue;
      effectivePlatform.add(current);
      pending.push(
        ...(PERMISSION_IMPLICATIONS[current] ?? []).filter((key) =>
          key.startsWith("platform."),
        ),
      );
    }
    return effectivePlatform.has(permission);
  }
  if (roles.includes("admin"))
    return true;
  const effective = new Set<PermissionKey>();
  const pending = permissions.filter((key): key is PermissionKey =>
    KNOWN_PERMISSION_KEYS.has(key as PermissionKey),
  );
  while (pending.length) {
    const current = pending.pop()!;
    if (effective.has(current)) continue;
    effective.add(current);
    pending.push(...(PERMISSION_IMPLICATIONS[current] ?? []));
  }
  return effective.has(permission);
}

/** Hotel workspace tabs, matched to the read grants required by their APIs. */
export function getHotelWorkspaceTabs(user: Parameters<typeof hasPermission>[0]): string[] {
  const tabs: Array<{ value: string; required: PermissionKey[] }> = [
    { value: "front-desk", required: ["hotel.view"] },
    { value: "bookings", required: ["hotel.view"] },
    { value: "inventory", required: ["hotel.view"] },
    { value: "rates", required: ["hotel.view"] },
    { value: "housekeeping", required: ["hotel.housekeeping.view"] },
    { value: "room-orders", required: ["hotel.view", "reports.analytics.view"] },
    { value: "finance", required: ["hotel.view", "finance.income.view"] },
    { value: "daybook", required: ["hotel.view", "reports.dayclose.view"] },
    { value: "night-audit", required: ["hotel.view", "hotel.night_audit.run"] },
  ];
  return tabs
    .filter(({ required }) => required.every((permission) => hasPermission(user, permission)))
    .map(({ value }) => value);
}

/** Exact UI capabilities used by the attendance workspace and its tabs. */
export function getAttendanceUiAccess(user: {
  role?: string | null;
  roles?: string[] | null;
  permissions?: string[];
} | null) {
  const canView = hasPermission(user, "attendance.view");
  const canManage = hasPermission(user, "attendance.manage");
  const canManageDevices = hasPermission(user, "attendance.device.manage");
  const canPayrollExport = hasPermission(user, "attendance.payroll.export");

  return {
    canView,
    canManage,
    canManageDevices,
    // The current attendance CSV route is guarded by attendance.view.
    canExport: canView,
    canPayrollExport,
    initialTab: canView
      ? "overview"
      : canManage
        ? "schedules"
        : canManageDevices
          ? "devices"
          : "payroll-export",
  } as const;
}

/** Loyalty redemption also updates the order after redeeming customer points. */
export function canRedeemOrderLoyalty(user: {
  role?: string | null;
  roles?: string[] | null;
  permissions?: string[];
} | null) {
  return (
    hasPermission(user, "customers.loyalty.manage") &&
    hasPermission(user, "pos.order.edit")
  );
}

/**
 * Keeps operational workspaces separated for staff assigned to only one
 * business module. Finance administrators retain access through their admin
 * role, while a hotel-only staff member cannot switch into restaurant close
 * screens merely because both modules share the same property.
 */
export function canAccessBusinessModule(
  user: {
    role?: string | null;
    roles?: string[] | null;
    permissions?: string[];
  } | null,
  businessLine: "restaurant" | "hotel",
): boolean {
  if (!user) return false;
  const roles = normalizeRolesForUser(user);
  const permissions = user.permissions ?? [];
  if (roles.includes("admin")) {
    return true;
  }
  if (businessLine === "hotel") {
    return permissions.some((permission) => permission.startsWith("hotel."));
  }
  return permissions.some(
    (permission) =>
      permission.startsWith("pos.") ||
      permission.startsWith("billing.") ||
      permission.startsWith("station."),
  );
}

// ─── Permission checks (match Flutter RolePermissions) ──────────────────────

export const canAccessSettings = (r: UserRole | null) =>
  isAdmin(r) || isManager(r);
export const canManageUsers = (r: UserRole | null) => isAdmin(r);
export const canManageMenu = (r: UserRole | null) => isAdmin(r) || isManager(r);
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
  requiredPermissions?: PermissionKey[];
  /** Opens in a new tab; not an in-app route */
  externalUrl?: string;
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
    href: "/orders",
    allowedRoles: ORDER_ROLES,
    requiredPermission: "pos.view",
  },
  {
    title: "Order History",
    href: "/orders/history",
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
    requiredPermissions: ["reports.daily.view", "reports.dayclose.view"],
  },
  {
    title: "Cash Drawers",
    href: "/cash-drawers",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermissions: [
      "day_close.drawer.open",
      "finance.drawer.open.own",
      "finance.drawer.open.any",
      "finance.drawer.close.own",
      "finance.drawer.close.any",
    ],
  },
  // ── Kitchen stations ──
  {
    title: "Kitchen",
    href: "/kitchen",
    allowedRoles: KITCHEN_ROLES,
    requiredPermissions: [
      "station.kitchen.view",
      "station.bar.view",
      "station.cafe.view",
    ],
  },
  // ── Manage sub-items ──
  {
    title: "Menu",
    href: "/menu/items",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermissions: ["menu.view", "pos.view"],
  },
  {
    title: "Categories",
    href: "/menu/categories",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermissions: ["menu.view", "pos.view"],
  },
  {
    title: "Options & add-ons",
    href: "/menu/modifiers",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermissions: ["menu.view", "pos.view"],
  },
  {
    title: "Inventory",
    href: "/inventory",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "inventory.view",
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    allowedRoles: ADMIN_MANAGER,
    requiredPermission: "inventory.suppliers.manage",
  },
  {
    title: "Finance",
    href: "/finance/income",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "finance.income.view",
  },
  {
    title: "Accounting",
    href: "/finance/accounting",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "finance.accounting.view",
  },
  {
    title: "Transactions",
    href: "/transactions",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermission: "finance.ledger.view",
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
    requiredPermissions: ["tables.view", "pos.view"],
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
    title: "Settings",
    href: "/settings",
    allowedRoles: ALL_DASHBOARD_ROLES,
    requiredPermission: "admin.settings.manage",
  },
  {
    title: "Attendance",
    href: "/attendance",
    allowedRoles: ADMIN_SHELL_ROLES,
    requiredPermissions: [
      "attendance.view",
      "attendance.manage",
      "attendance.device.manage",
      "attendance.payroll.export",
    ],
  },
  {
    title: "Overview",
    href: "/grow",
    allowedRoles: ADMIN_MANAGER,
    requiredPermission: "grow.view",
  },
  {
    title: "Campaigns",
    href: "/grow/campaigns",
    allowedRoles: ADMIN_MANAGER,
    requiredPermission: "grow.view",
  },
  {
    title: "Subscribers",
    href: "/grow/subscribers",
    allowedRoles: ADMIN_MANAGER,
    requiredPermission: "grow.view",
  },
  {
    title: "Feedback",
    href: "/feedback",
    allowedRoles: ALL_DASHBOARD_ROLES,
  },
];

export function getSidebarItemsForRole(role: UserRole | null) {
  if (!role) return [];
  return SIDEBAR_ROLE_MAP.filter((item) => item.allowedRoles.includes(role));
}

export function getSidebarItemsForRoles(
  roles: UserRole[],
  user?: {
    role?: string | null;
    roles?: string[] | null;
    permissions?: string[];
  } | null,
) {
  return SIDEBAR_ROLE_MAP.filter((item) => {
    if (item.href === "/orders/new") {
      return (
        hasPermission(user || null, "pos.order.create") &&
        (hasPermission(user || null, "menu.view") ||
          hasPermission(user || null, "pos.view"))
      );
    }
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
    if (item.requiredPermissions) {
      return item.requiredPermissions.some((permission) =>
        hasPermission(user || null, permission),
      );
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
  "/dashboard/payments": "billing.view",
  "/dashboard/subscriptions": "billing.view",
  "/analytics": "reports.analytics.view",
  "/transactions": "finance.ledger.view",
  "/orders": "pos.view",
  "/receipts": "billing.receipt.view",
  "/orders/new": "pos.order.create",
  "/orders/create": "pos.order.create",
  "/orders/history": "pos.view",
  "/orders/active": "pos.view",
  "/order-history": "pos.view",
  "/customers": "customers.view",
  // Management
  "/menu/categories": "menu.view",
  "/menu/items": "menu.view",
  "/menu/modifiers": "menu.view",
  "/inventory": "inventory.view",
  "/suppliers": "inventory.suppliers.manage",
  "/reservations": "tables.reservation.view",
  "/discounts": "pos.order.discount.apply",
  "/rooms/checkin": "hotel.checkin",
  "/rooms": "hotel.view",
  "/hotel": "hotel.view",
  "/grow/campaigns/new": "grow.campaigns.manage",
  "/grow/campaigns": "grow.view",
  "/grow/subscribers": "grow.view",
  "/grow": "grow.view",
  // Finance
  "/finance/heads": "finance.coa.view",
  "/finance/reports/sales-book": "finance.reports.sales.view",
  "/finance/reports/invoices": "finance.reports.invoices.view",
  "/finance/reports/payments": "finance.reports.payments.view",
  "/finance/reports/vat-sales": "finance.reports.tax.view",
  "/finance/reports/vat-summary": "finance.reports.tax.view",
  "/finance/reports/profit-and-loss": "finance.accounting.view",
  "/finance/reports/balance-sheet": "finance.accounting.view",
  "/finance/reports/cash-flow": "finance.accounting.view",
  "/finance/reports/trial-balance": "finance.accounting.view",
  "/finance/reports/account-ledger": "finance.ledger.view",
  "/finance/reports/party-balances": "finance.ledger.view",
  "/finance/reports/head-activity": "finance.coa.view",
  "/finance/reports/department-breakdown": "finance.income.view",
  "/finance/reports/daybook": "finance.daybook.view",
  "/finance/reports/custody-reconciliation": "finance.daybook.view",
  "/finance/reports/refunds": "finance.reports.payments.view",
  "/finance/expenses": "finance.expenses.view",
  "/finance": "finance.income.view",
  "/finance/income": "finance.income.view",
  "/finance/income-expenses": "finance.income.view",
  "/finance/other-income": "finance.income.view",
  "/finance/transactions": "finance.ledger.view",
  "/finance/purchases": "inventory.view",
  "/inventory/purchases": "inventory.view",
  "/inventory/purchases/returns": "inventory.view",
  "/finance/sales/returns": "finance.sales.return",
  "/finance/sales": "finance.sales.view",
  "/finance/accounting/inventory": "inventory.accounting.view",
  "/finance/accounting": "finance.accounting.view",
  // Admin
  "/staff/join-requests": "admin.staff.manage",
  "/staff": "admin.staff.view",
  "/manage/roles": "admin.roles.manage",
  "/manage/additional-settings": "admin.settings.manage",
  "/manage/settings": "admin.settings.manage",
  "/manage/business-profile": "admin.settings.manage",
  "/manage/compliance": "admin.settings.manage",
  "/manage/audit-logs": "admin.settings.manage",
  "/manage/awaiting-payments": "admin.settings.manage",
  "/manage/purchases": "inventory.view",
  "/manage/receipt-designer": "admin.settings.manage",
  "/manage/kot-designer": "admin.settings.manage",
  "/manage/suppliers": "inventory.suppliers.manage",
  "/manage/taxes": "admin.settings.manage",
  "/settings": "admin.settings.manage",
  "/settings/administrators": "admin.staff.manage",
  "/settings/branding": "admin.settings.manage",
  "/settings/business-profile": "admin.settings.manage",
  "/settings/finance": "admin.settings.manage",
  "/settings/kot-designer": "admin.settings.manage",
  "/settings/payment-integrations": "admin.settings.manage",
  "/settings/printers": "admin.settings.manage",
  "/settings/receipt-designer": "admin.settings.manage",
  "/settings/roles": "admin.roles.manage",
  "/settings/taxes": "admin.settings.manage",
  "/manage/stations": "inventory.stations.view",
  "/attendance": "attendance.view",
  "/period-reports": "reports.periodic.view",
  "/hotel-close": "hotel.night_audit.run",
};

/** Shared landing pages for features with independently granted capabilities. */
export const ROUTE_ANY_PERMISSIONS: Record<string, PermissionKey[]> = {
  "/manage": [
    "admin.staff.view",
    "admin.staff.manage",
    "admin.roles.manage",
    "admin.settings.manage",
    "inventory.view",
    "inventory.suppliers.manage",
    "inventory.items.manage",
    "inventory.stock.manage",
    "inventory.stock.add",
    "inventory.stock.reduce",
    "inventory.purchases.post",
    "inventory.purchases.void",
    "inventory.purchase_returns.create",
    "inventory.recipes.manage",
    "inventory.stations.view",
    "attendance.view",
    "attendance.manage",
    "attendance.clock",
    "menu.items.manage",
    "menu.categories.manage",
    "tables.manage",
    "hotel.view",
    "hotel.manage",
    "finance.income.view",
    "finance.accounting.view",
    "finance.expenses.view",
    "finance.expenses.manage",
  ],
  "/menu": ["menu.view", "pos.view"],
  "/menu/categories": ["menu.view", "pos.view"],
  "/menu/items": ["menu.view", "pos.view"],
  "/menu/modifiers": ["menu.view", "pos.view"],
  "/tables": ["tables.view", "pos.view"],
  "/finance/operations": [
    "finance.daybook.view",
    "finance.drawer.transfer.to_safe",
    "finance.cash.transfer.to_bank",
  ],
  "/finance/reports": [
    "finance.income.view",
    "finance.reports.sales.view",
    "finance.reports.invoices.view",
    "finance.reports.payments.view",
    "finance.reports.tax.view",
    "finance.accounting.view",
  ],
  "/finance/setup": [
    "finance.accounting.setup",
    "finance.coa.view",
    "finance.payment_instruments.manage",
    "finance.payment_settlements.manage",
  ],
  "/finance/payments": ["finance.reports.payments.view"],
  "/finance/receivables": [
    "customers.credit.manage",
    "customers.view",
    "finance.ledger.view",
  ],
  "/finance/payables": [
    "inventory.suppliers.manage",
    "inventory.view",
    "finance.expenses.view",
  ],
  "/day-close": ["reports.daily.view", "reports.dayclose.view"],
  "/attendance": ["attendance.manage", "attendance.device.manage", "attendance.payroll.export"],
  "/cash-drawers": [
    "day_close.drawer.open",
    "finance.drawer.open.own",
    "finance.drawer.open.any",
    "finance.drawer.close.own",
    "finance.drawer.close.any",
  ],
  "/kitchen": ["station.kitchen.view", "station.bar.view", "station.cafe.view"],
  "/hotel": [
    "hotel.view",
    "hotel.manage",
    "hotel.checkin",
    "hotel.checkout",
    "hotel.early_departure.override",
    "hotel.folio.view",
    "hotel.folio.edit",
    "hotel.folio.override",
    "hotel.bookings.manage",
    "hotel.inventory.manage",
    "hotel.housekeeping.view",
    "hotel.housekeeping.manage",
    "hotel.rates.manage",
    "hotel.night_audit.run",
  ],
  "/premium": ["admin.settings.manage", "billing.view"],
};

const DYNAMIC_ROUTE_PERMISSIONS: Array<{
  pattern: RegExp;
  permissions: PermissionKey[];
  requiresAll?: PermissionKey[];
}> = [
  { pattern: /^\/orders\/[^/]+\/(?:edit|add-items)$/, permissions: ["pos.order.edit"], requiresAll: ["pos.view"] },
  { pattern: /^\/orders\/[^/]+\/checkout$/, permissions: ["billing.view", "billing.payment.process", "billing.bill.split", "hotel.checkout"], requiresAll: ["pos.view"] },
  { pattern: /^\/orders\/[^/]+\/receipt$/, permissions: ["billing.receipt.view", "billing.receipt.print"], requiresAll: ["pos.view"] },
  { pattern: /^\/customers\/[^/]+$/, permissions: ["customers.view"] },
  { pattern: /^\/staff\/[^/]+$/, permissions: ["admin.staff.view"] },
  { pattern: /^\/suppliers\/[^/]+$/, permissions: ["inventory.suppliers.manage"] },
  { pattern: /^\/transactions\/[^/]+$/, permissions: ["finance.ledger.view"] },
];

// ─── Route-level ACL ────────────────────────────────────────────────────────
// Maps route prefixes to allowed roles. Used by RoleGuard component.

export const ROUTE_ROLES: Record<string, UserRole[]> = {
  "/dashboard": ADMIN_SHELL_ROLES,
  "/orders": ORDER_ROLES,
  "/analytics": ADMIN_SHELL_ROLES,
  "/day-close": ADMIN_SHELL_ROLES,
  "/cash-drawers": ADMIN_SHELL_ROLES,
  "/transactions": ADMIN_SHELL_ROLES,
  "/menu": ADMIN_MANAGER,
  "/kitchen": KITCHEN_ROLES,
  "/inventory": ADMIN_MANAGER,
  "/finance/heads": ADMIN_SHELL_ROLES,
  "/finance/income": ADMIN_SHELL_ROLES,
  "/finance/expenses": ADMIN_SHELL_ROLES,
  "/customers": ADMIN_SHELL_ROLES,
  "/grow": ADMIN_MANAGER,
  "/tables": ADMIN_MANAGER,
  "/rooms": ["admin", "manager", "cashier", "waiter"],
  "/reservations": ADMIN_SHELL_ROLES,
  "/discounts": ADMIN_MANAGER,
  "/manage": ADMIN_MANAGER,
  "/manage/additional-settings": ADMIN_MANAGER,
  "/staff": ADMIN_MANAGER,
  "/attendance": ADMIN_MANAGER,
  "/workforce": ADMIN_MANAGER,
  "/settings": ALL_DASHBOARD_ROLES,
  "/feedback": ALL_DASHBOARD_ROLES,
  "/help-center": ALL_DASHBOARD_ROLES,
  "/premium": ADMIN_MANAGER,
  "/welcome": ["user", ...ALL_DASHBOARD_ROLES],
  "/gateway": ["user", ...ALL_DASHBOARD_ROLES],
};

export function isRouteAllowed(
  pathname: string,
  user: {
    role?: string | null;
    roles?: string[] | null;
    primary_role?: string | null;
    permissions?: string[];
    restaurant_id?: number | null;
  } | null,
): boolean {
  if (!user) return false;

  // The Profile tab is self-service; every signed-in user can edit their own
  // account details without needing staff-management permission.
  if (pathname === "/manage/profile") return true;

  // Leaving is membership self-service. Do not tie it to a tenant permission
  // that may not exist for a legitimate custom-role or legacy-association
  // member. The backend remains authoritative when the action is submitted.
  if (pathname === "/leave-restaurant") {
    return true;
  }

  // Creating an order also needs readable menu data or POS order scope; the
  // backend's grouped-menu and order APIs enforce those complementary grants.
  if (pathname === "/orders/new" || pathname === "/orders/create") {
    return (
      hasPermission(user, "pos.order.create") &&
      (hasPermission(user, "menu.view") || hasPermission(user, "pos.view"))
    );
  }

  // Join requests require staff management, not staff profile viewing. Keep
  // this exact route ahead of the dynamic /staff/:id detail rule below.
  if (pathname === "/staff/join-requests") {
    return hasPermission(user, "admin.staff.manage");
  }

  if (pathname === "/analytics/compare" || pathname.startsWith("/analytics/compare/")) {
    return (
      hasAnalyticsViewPermission(user) &&
      hasPermission(user, "reports.period.insights")
    );
  }

  // Analytics routes never bypass via admin role — explicit permission only
  if (isAnalyticsGatedPath(pathname)) {
    return hasAnalyticsViewPermission(user);
  }

  // Build the set of normalized legacy roles for this user
  const roles = normalizeRolesForUser(user);
  const isGlobalAdmin = roles.includes("admin");

  if (isGlobalAdmin) return true;

  const dynamicRoute = DYNAMIC_ROUTE_PERMISSIONS.find(({ pattern }) =>
    pattern.test(pathname),
  );
  if (dynamicRoute) {
    return (
      (dynamicRoute.requiresAll ?? []).every((permission) =>
        hasPermission(user, permission),
      ) &&
      dynamicRoute.permissions.some((permission) => hasPermission(user, permission))
    );
  }

  // 1. Check Granular Permissions first (works for both legacy & custom-role users)
  const sortedPermissionPrefixes = Array.from(
    new Set([
      ...Object.keys(ROUTE_PERMISSIONS),
      ...Object.keys(ROUTE_ANY_PERMISSIONS),
    ]),
  ).sort(
    (a, b) => b.length - a.length,
  );
  for (const prefix of sortedPermissionPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      const required = ROUTE_PERMISSIONS[prefix];
      const anyRequired = ROUTE_ANY_PERMISSIONS[prefix];
      return [required, ...(anyRequired ?? [])]
        .filter((permission): permission is PermissionKey => Boolean(permission))
        .some((permission) => hasPermission(user, permission));
    }
  }

  // 2. No permission guard on this route — fall back to legacy role check
  if (!roles.length) return false;

  const sortedPrefixes = Object.keys(ROUTE_ROLES).sort(
    (a, b) => b.length - a.length,
  );

  for (const prefix of sortedPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return roles.some((role) => ROUTE_ROLES[prefix].includes(role));
    }
  }

  return false;
}

export function isRouteAllowedMulti(
  pathname: string,
  user: {
    role: string;
    roles?: string[];
    primary_role?: string | null;
    permissions?: string[];
    restaurant_id?: number | null;
  } | null,
): boolean {
  return isRouteAllowed(pathname, user);
}

/** Route guard helper for sidebar/manage links (strips query strings). */
export function isPathAccessible(
  href: string,
  user: {
    role?: string | null;
    roles?: string[] | null;
    primary_role?: string | null;
    permissions?: string[];
    restaurant_id?: number | null;
  } | null,
): boolean {
  const path = href.split("?")[0];
  return isRouteAllowed(path, user);
}

/** Hotel sidebar href → permission key (matches ROUTE_PERMISSIONS where applicable). */
export const HOTEL_SIDEBAR_PERMISSIONS: Partial<Record<string, PermissionKey>> =
  {
    "/rooms": "hotel.view",
    "/rooms/checkin": "hotel.manage",
    "/orders": "pos.view",
    "/orders/new": "pos.order.create",
    "/reservations": "tables.reservation.view",
    "/finance/income": "finance.income.view",
    "/customers": "customers.view",
    "/manage": "admin.staff.view",
    "/settings": "admin.settings.manage",
    "/analytics": "reports.analytics.view",
  };

export function filterSidebarLinksByAccess<T extends { href: string }>(
  items: T[],
  user: Parameters<typeof isPathAccessible>[1],
): T[] {
  return items.flatMap((item) => {
    const nestedItem = item as T & { subItems?: T[] };
    const accessibleChildren = nestedItem.subItems
      ? filterSidebarLinksByAccess(nestedItem.subItems, user)
      : undefined;
    const hotelPerm = HOTEL_SIDEBAR_PERMISSIONS[item.href];
    const canOpenSelf = hotelPerm
      ? hasPermission(user, hotelPerm)
      : isPathAccessible(item.href, user);
    if (!canOpenSelf && !accessibleChildren?.length) return [];
    const nextItem = { ...nestedItem } as T & { subItems?: T[] };
    if (accessibleChildren) nextItem.subItems = accessibleChildren;
    if (!canOpenSelf && accessibleChildren?.length) {
      nextItem.href = accessibleChildren[0].href;
    }
    return [nextItem as T];
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
  if (hasAnyRole(roles, ["kitchen", "bar", "cafe", "barista"]))
    return "/kitchen";
  if (roles.includes("user")) return "/welcome";
  return "/";
}

/**
 * Get home route for a full user object.
 * Uses permissions as a fallback for custom-role users who have no
 * normalized legacy role but still have granular permissions.
 */
export function getHomeRouteForUser(
  user: {
    role?: string | null;
    roles?: string[] | null;
    primary_role?: string | null;
    permissions?: string[];
    restaurant_id?: number | null;
  } | null,
): string {
  if (!user) return "/";

  const roles = normalizeRolesForUser(user);
  if (Array.isArray(user.permissions)) {
    const preferred = hasAnyRole(roles, ["admin", "manager", "cashier"])
      ? ["/dashboard", "/orders/active", "/orders/new", "/kitchen"]
      : hasAnyRole(roles, ["waiter"])
      ? ["/orders/active", "/orders/new", "/kitchen"]
      : hasAnyRole(roles, ["kitchen", "bar", "cafe", "barista"])
        ? ["/kitchen", "/orders/active", "/orders/new"]
        : roles.length ? ["/dashboard"] : ["/orders/active", "/orders/new"];
    const candidates = [
      ...preferred, "/dashboard", "/orders/active", "/orders/new", "/kitchen",
      "/hotel", "/finance", "/finance/operations", "/finance/reports", "/finance/accounting",
      "/manage", "/workforce", "/staff", "/attendance", "/analytics",
      "/customers", "/tables", "/reservations", "/inventory", "/menu/items",
    ];
    return candidates.find((route) => isRouteAllowed(route, user)) ?? "/manage/profile";
  }
  const home = getHomeRouteForRoles(roles);
  return home === "/welcome" && user.restaurant_id ? "/dashboard" : home === "/" ? "/manage/profile" : home;
}
