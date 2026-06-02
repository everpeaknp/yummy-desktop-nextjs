import type { AxiosError } from "axios";

export type ScopeErrorKind =
  | "plan_date_limit"
  | "plan_record_limit"
  | "role_manager_limit"
  | "role_cashier_limit"
  | "user_access_scope"
  | "permission_denied"
  | "unknown";

export type ParsedScopeError = {
  kind: ScopeErrorKind;
  message: string;
  maxDays?: number;
  requiredPlan?: string;
  code?: string;
};

type ErrorDetailObject = {
  code?: string;
  message?: string;
  max_days?: number;
  required_plan?: string;
  current_plan?: string;
  feature?: string;
};

function asDetailObject(detail: unknown): ErrorDetailObject | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  return detail as ErrorDetailObject;
}

function detailMessage(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  const obj = asDetailObject(detail);
  if (obj?.message?.trim()) return obj.message.trim();
  return null;
}

export function parseApiScopeError(
  error: unknown,
  context?: { role?: string | null }
): ParsedScopeError | null {
  const axiosErr = error as AxiosError<{ detail?: unknown; message?: string }>;
  if (axiosErr?.response?.status !== 403) return null;

  const detail = axiosErr.response?.data?.detail;
  const obj = asDetailObject(detail);
  const code = obj?.code;
  const text =
    detailMessage(detail) ||
    (typeof axiosErr.response?.data?.message === "string"
      ? axiosErr.response.data.message
      : null) ||
    "You do not have permission to view data for this date range.";

  if (code === "PLAN_DATE_SCOPE_EXCEEDED" || code === "PLAN_LIMIT_REACHED") {
    return {
      kind: code === "PLAN_LIMIT_REACHED" ? "plan_record_limit" : "plan_date_limit",
      message: text,
      maxDays: obj?.max_days,
      requiredPlan: obj?.required_plan || "paid",
      code,
    };
  }

  if (/cashier/i.test(text) && /24 hours|today|past/i.test(text)) {
    return {
      kind: "role_cashier_limit",
      message: "Cashiers can only view today's data. Choose today's date range to continue.",
      code,
    };
  }

  if (/only from .+ onward|only up to/i.test(text)) {
    return {
      kind: "user_access_scope",
      message: text,
      code,
    };
  }

  const role = (context?.role || "").toLowerCase();
  if (
    role === "manager" ||
    /not allowed to access this permission/i.test(text) ||
    /30 day/i.test(text)
  ) {
    return {
      kind: "role_manager_limit",
      message: "Managers are restricted to viewing the last 30 days of data.",
      maxDays: 30,
      code,
    };
  }

  if (role === "cashier" || role === "waiter") {
    return {
      kind: "role_cashier_limit",
      message: "Your role is restricted to viewing today's orders only.",
      maxDays: 1,
      code,
    };
  }

  return {
    kind: "permission_denied",
    message: text,
    code,
  };
}

export function isPlanScopeError(parsed: ParsedScopeError | null): boolean {
  return parsed?.kind === "plan_date_limit" || parsed?.kind === "plan_record_limit";
}
