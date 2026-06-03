import type { TransactionsListQueryParams } from "@/lib/api/endpoint-types";

export type TransactionType = "order" | "expense" | "inventory" | "manualIncome";

export type TransactionItem = {
  id: string;
  type: TransactionType;
  title: string;
  amount?: number | string | null;
  user_id?: number | null;
  user_name?: string | null;
  payment_user_id?: number | null;
  payment_user_name?: string | null;
  created_at: string;
  details?: Record<string, unknown> | null;
};

export type TransactionsResponse = {
  items: TransactionItem[];
  total: number;
};

export type StaffOption = {
  id: number;
  name: string;
};

export const TYPE_META: Record<
  TransactionType,
  { label: string; badge: string }
> = {
  order: {
    label: "Order",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-500",
  },
  expense: {
    label: "Expense",
    badge: "bg-red-500/10 text-red-700 dark:text-red-500",
  },
  inventory: {
    label: "Inventory",
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  },
  manualIncome: {
    label: "Manual Income",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-500",
  },
};

export const ALL_TRANSACTION_TYPES = Object.keys(TYPE_META) as TransactionType[];

function coerceNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Resolve backend order PK from transaction row (details.order_id or legacy id). */
export function resolveOrderIdFromTransaction(
  item: Pick<TransactionItem, "id" | "type" | "details">
): number | null {
  if (item.type !== "order") return null;

  const fromDetails = coerceNumber(
    (item.details as Record<string, unknown> | null | undefined)?.order_id
  );
  if (fromDetails !== null) return fromDetails;

  const match = String(item.id).match(/^order-(\d+)$/i);
  if (match) {
    const n = Number(match[1]);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

export type TransactionNavigation =
  | { kind: "order"; orderId: number; href: string }
  | { kind: "detail" };

export function getTransactionNavigation(
  item: TransactionItem
): TransactionNavigation {
  const orderId = resolveOrderIdFromTransaction(item);
  if (item.type === "order" && orderId !== null) {
    return { kind: "order", orderId, href: `/orders/${orderId}` };
  }
  return { kind: "detail" };
}

export function isOrderTransactionId(id: string): boolean {
  return /^order-\d+$/i.test(String(id));
}

export function orderIdFromTransactionId(id: string): number | null {
  const match = String(id).match(/^order-(\d+)$/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export type TransactionsFilterState = {
  restaurantId: number;
  userId?: number;
  paymentUserId?: number;
  types?: TransactionType[];
  dateFrom?: string;
  dateTo?: string;
  skip?: number;
  limit?: number;
};

/** Build list query; payment_user_id always scopes to order-only on the API. */
export function buildTransactionsListQuery(
  state: TransactionsFilterState
): TransactionsListQueryParams {
  const paymentUserId = state.paymentUserId;
  const types =
    paymentUserId != null
      ? (["order"] as const)
      : state.types?.length
        ? state.types
        : undefined;

  return {
    restaurantId: state.restaurantId,
    userId: state.userId,
    paymentUserId,
    types: types as string[] | undefined,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    skip: state.skip ?? 0,
    limit: state.limit ?? 50,
  };
}

export function staffLabel(
  staff: StaffOption[],
  userId: number | null | undefined,
  fallback?: string | null
): string {
  if (fallback?.trim()) return fallback.trim();
  if (userId == null) return "—";
  const hit = staff.find((s) => s.id === userId);
  return hit?.name ?? `User #${userId}`;
}

function parseParenSuffix(title: string): string | null {
  const t = String(title || "").trim();
  const m = t.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : null;
}

function formatMaybeNumberPrefix(s: string): string {
  const raw = String(s || "").trim();
  if (!raw) return raw;
  const parts = raw.split(/\s+/);
  const n = Number(parts[0]);
  if (!Number.isFinite(n)) return raw;
  const unit = parts.slice(1).join(" ");
  const pretty = Number.isInteger(n)
    ? n.toString()
    : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit ? `${pretty} ${unit}` : pretty;
}

export function getInventoryDelta(it: TransactionItem): string | null {
  if (it.type !== "inventory") return null;
  const suffix = parseParenSuffix(it.title);
  if (suffix) return formatMaybeNumberPrefix(suffix);

  const d = (it.details || {}) as Record<string, unknown>;
  const qty = d.qty ?? d.quantity ?? d.delta ?? d.change ?? d.units ?? d.pieces;
  const unit = d.unit ?? d.uom ?? d.measurement ?? d.unit_name;
  const n = coerceNumber(qty);
  if (n === null) return null;
  const pretty = Number.isInteger(n)
    ? n.toString()
    : n.toLocaleString(undefined, { maximumFractionDigits: 3 });
  const unitStr = unit != null ? String(unit) : "";
  return unitStr ? `${pretty} ${unitStr}` : pretty;
}

export function getTransactionAmount(it: TransactionItem): number | null {
  if (it.type === "inventory") return null;

  const direct = coerceNumber(it.amount);
  if (direct !== null) return direct;

  const d = (it.details || {}) as Record<string, unknown>;
  const keys = [
    "amount",
    "total_amount",
    "total",
    "net_total",
    "grand_total",
    "paid_total",
    "order_total",
    "total_cost",
    "cost",
    "value",
  ];
  for (const k of keys) {
    const n = coerceNumber(d[k]);
    if (n !== null) return n;
  }

  const nestedCandidates = [d.order, d.expense, d.income, d.payment, d.transaction, d.data, d.payload].filter(
    (v) => v && typeof v === "object" && !Array.isArray(v)
  ) as Record<string, unknown>[];

  for (const obj of nestedCandidates) {
    for (const k of keys) {
      const n = coerceNumber(obj[k]);
      if (n !== null) return n;
    }
  }

  for (const v of Object.values(d)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    for (const k of keys) {
      const n = coerceNumber((v as Record<string, unknown>)[k]);
      if (n !== null) return n;
    }
  }

  return null;
}
