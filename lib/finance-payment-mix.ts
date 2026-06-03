import type { PaymentMixView } from "@/types/analytics";

const METHOD_ORDER = ["cash", "card", "digital", "fonepay", "credit"] as const;

function normalizePaymentMethod(method: string): string {
  return method.trim().toLowerCase();
}

function sortMethodRows(
  rows: Array<{ method: string; amount: number }>
): Array<{ method: string; amount: number }> {
  return rows.slice().sort((a, b) => {
    const ai = METHOD_ORDER.indexOf(
      normalizePaymentMethod(a.method) as (typeof METHOD_ORDER)[number]
    );
    const bi = METHOD_ORDER.indexOf(
      normalizePaymentMethod(b.method) as (typeof METHOD_ORDER)[number]
    );
    const aRank = ai === -1 ? METHOD_ORDER.length : ai;
    const bRank = bi === -1 ? METHOD_ORDER.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    return b.amount - a.amount;
  });
}

type IncomeMethodRow = { method?: string; amount?: number };
type IncomeInstrumentRow = {
  method?: string;
  instrument?: string;
  amount?: number;
};

/** Income dashboard `by_payment_method` + `by_payment_instrument` (backend aggregates only). */
export function mapIncomeDashboardPaymentMix(
  byPaymentMethod: IncomeMethodRow[] | null | undefined,
  byPaymentInstrument: IncomeInstrumentRow[] | null | undefined
): PaymentMixView {
  const methodRows = (byPaymentMethod ?? [])
    .map((row) => ({
      method: String(row.method ?? "unknown").trim() || "unknown",
      amount: Number(row.amount ?? 0),
    }))
    .filter((row) => row.amount > 0);

  const instrumentGrouped: Record<
    string,
    Array<{ name: string; amount: number }>
  > = {};

  for (const row of byPaymentInstrument ?? []) {
    const methodKey = normalizePaymentMethod(String(row.method ?? ""));
    if (methodKey !== "card" && methodKey !== "digital") continue;
    const name = String(row.instrument ?? "").trim() || "Unspecified";
    instrumentGrouped[methodKey] ??= [];
    instrumentGrouped[methodKey].push({
      name,
      amount: Number(row.amount ?? 0),
    });
  }

  const sorted = sortMethodRows(methodRows);
  if (sorted.length === 0) {
    return { available: false, methods: [], expandedPieSlices: [] };
  }

  const methods = sorted.map((row) => {
    const methodKey = normalizePaymentMethod(row.method);
    const instruments =
      methodKey === "card" || methodKey === "digital"
        ? (instrumentGrouped[methodKey] ?? [])
            .slice()
            .sort((a, b) => b.amount - a.amount)
        : [];
    return {
      method: row.method,
      amount: row.amount,
      instruments,
    };
  });

  return {
    available: true,
    methods,
    expandedPieSlices: sorted.map((row) => ({
      name: row.method,
      value: row.amount,
    })),
  };
}

type ExpenseRow = {
  payment_method?: string | null;
  amount?: number | string | null;
};

/**
 * Payment-method breakdown from a complete expense list (all pages fetched).
 * Headline totals must still come from `GET /expenses/summary/total`.
 */
export function mapExpenseRowsToPaymentMix(
  expenses: ExpenseRow[]
): PaymentMixView {
  const buckets = new Map<string, number>();

  for (const expense of expenses) {
    const rawMethod = String(expense.payment_method ?? "unknown").trim() || "unknown";
    const key = normalizePaymentMethod(rawMethod);
    const amount = Number(expense.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + amount);
  }

  const methodRows = sortMethodRows(
    Array.from(buckets.entries()).map(([method, amount]) => ({
      method,
      amount,
    }))
  );

  if (methodRows.length === 0) {
    return { available: false, methods: [], expandedPieSlices: [] };
  }

  return {
    available: true,
    methods: methodRows.map((row) => ({
      method: row.method,
      amount: row.amount,
      instruments: [],
    })),
    expandedPieSlices: methodRows.map((row) => ({
      name: row.method,
      value: row.amount,
    })),
  };
}
