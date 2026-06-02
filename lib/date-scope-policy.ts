import { endOfDay, startOfDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";

import { normalizeRole, normalizeRolesForUser, type UserRole } from "@/lib/role-permissions";

export const MANAGER_MAX_LOOKBACK_DAYS = 30;
export const FREE_PLAN_MAX_LOOKBACK_DAYS = 30;

export function resolvePrimaryRole(
  user: { role?: string | null; roles?: string[] | null; primary_role?: string | null } | null
): UserRole | null {
  const roles = normalizeRolesForUser(user);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("manager")) return "manager";
  if (roles.includes("cashier")) return "cashier";
  if (roles.includes("waiter")) return "waiter";
  return roles[0] ?? normalizeRole(user?.role);
}

export function isFreePlan(effectivePlan?: string | null): boolean {
  const plan = (effectivePlan || "free").toLowerCase();
  return plan === "free";
}

export function defaultHistoryDateRange(role: UserRole | null): DateRange {
  const today = new Date();
  if (role === "cashier" || role === "waiter") {
    return { from: startOfDay(today), to: endOfDay(today) };
  }
  if (role === "manager") {
    return { from: subDays(today, MANAGER_MAX_LOOKBACK_DAYS), to: today };
  }
  return { from: subDays(today, FREE_PLAN_MAX_LOOKBACK_DAYS - 1), to: today };
}

export type AnalyticsPreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "month"
  | "custom";

export function getAnalyticsPresetRange(
  preset: AnalyticsPreset,
  customRange?: DateRange
): DateRange | undefined {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "last7":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "last30":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "month":
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(now),
      };
    case "custom":
      return customRange;
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

export function validationToScopeError(
  validation: Exclude<DateScopeValidation, { allowed: true }>
): import("@/lib/parse-api-scope-error").ParsedScopeError {
  return {
    kind: validation.kind,
    message: validation.message,
    maxDays: validation.maxDays,
  };
}

export function validateAnalyticsDateRange(
  range: DateRange | undefined,
  options: {
    role: UserRole | null;
    effectivePlan?: string | null;
  }
): DateScopeValidation {
  const result = validateHistoryDateRange(range, options);
  if (result.allowed) return result;
  if (result.kind === "role_cashier_limit") {
    return {
      ...result,
      message: "Cashiers can only view analytics for the past 24 hours.",
    };
  }
  return result;
}

export type DateScopeValidation =
  | { allowed: true }
  | {
      allowed: false;
      kind: "plan_date_limit" | "role_manager_limit" | "role_cashier_limit";
      message: string;
      maxDays: number;
      suggestedRange: DateRange;
    };

function daysBetween(from: Date, to: Date): number {
  const start = startOfDay(from).getTime();
  const end = startOfDay(to).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

export function validateHistoryDateRange(
  range: DateRange | undefined,
  options: {
    role: UserRole | null;
    effectivePlan?: string | null;
  }
): DateScopeValidation {
  const from = range?.from;
  const to = range?.to ?? range?.from;
  if (!from || !to) return { allowed: true };

  const today = new Date();
  const oldestFreeAllowed = subDays(today, FREE_PLAN_MAX_LOOKBACK_DAYS - 1);

  if (isFreePlan(options.effectivePlan) && startOfDay(from) < startOfDay(oldestFreeAllowed)) {
    return {
      allowed: false,
      kind: "plan_date_limit",
      message: `Free plan can only access the last ${FREE_PLAN_MAX_LOOKBACK_DAYS} days of data.`,
      maxDays: FREE_PLAN_MAX_LOOKBACK_DAYS,
      suggestedRange: { from: oldestFreeAllowed, to: today },
    };
  }

  if (options.role === "cashier" || options.role === "waiter") {
    const todayStart = startOfDay(today);
    if (startOfDay(from) < todayStart || startOfDay(to) < todayStart) {
      return {
        allowed: false,
        kind: "role_cashier_limit",
        message: "Your role is restricted to viewing today's orders only.",
        maxDays: 1,
        suggestedRange: { from: todayStart, to: today },
      };
    }
  }

  if (options.role === "manager") {
    const oldestManagerAllowed = subDays(today, MANAGER_MAX_LOOKBACK_DAYS);
    if (startOfDay(from) < startOfDay(oldestManagerAllowed)) {
      return {
        allowed: false,
        kind: "role_manager_limit",
        message: "Managers are restricted to viewing the last 30 days of data.",
        maxDays: MANAGER_MAX_LOOKBACK_DAYS,
        suggestedRange: { from: oldestManagerAllowed, to: today },
      };
    }
  }

  // Admin on paid plan: unlimited
  if (daysBetween(from, to) > 0) {
    return { allowed: true };
  }

  return { allowed: true };
}
