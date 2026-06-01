export type PaymentSummaryKey = "cash" | "card" | "fonepay" | "digital" | "credit";

export type PaymentSummaryLine = {
  key: PaymentSummaryKey;
  label: string;
  amount: number;
};

export const PAYMENT_SUMMARY_ORDER: PaymentSummaryKey[] = [
  "cash",
  "card",
  "fonepay",
  "digital",
  "credit",
];

export const PAYMENT_SUMMARY_LABELS: Record<PaymentSummaryKey, string> = {
  cash: "Cash",
  card: "Card",
  fonepay: "Fonepay",
  digital: "Digital/QR",
  credit: "Credit payments",
};

const SALES_FIELD_BY_KEY: Record<PaymentSummaryKey, string> = {
  cash: "cash_sales",
  card: "card_sales",
  fonepay: "fonepay_sales",
  digital: "digital_sales",
  credit: "credit_sales",
};

function toAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["amount", "total", "value", "sales"]) {
      if (key in obj) return toAmount(obj[key]);
    }
  }
  return 0;
}

/** Map raw backend / instrument labels into the five POS payment buckets. */
export function classifyPaymentLabel(raw: string): PaymentSummaryKey | null {
  const label = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");

  if (!label) return null;

  if (label.includes("fonepay") || label.includes("fone pay")) {
    return "fonepay";
  }

  if (
    label.includes("city ledger") ||
    label === "city-ledger" ||
    (label.includes("credit") &&
      !label.includes("card") &&
      !label.includes("collection") &&
      !label.includes("machine"))
  ) {
    return "credit";
  }

  if (label === "cash" || (label.includes("cash") && !label.includes("fonepay"))) {
    return "cash";
  }

  if (
    label.includes("digital") ||
    label.includes(" qr") ||
    label.startsWith("qr") ||
    label.includes("wallet") ||
    label.includes("esewa") ||
    label.includes("khalti") ||
    label.includes("unspecified qr")
  ) {
    return "digital";
  }

  if (
    label.includes("card") ||
    label.includes("debit") ||
    label.includes("visa") ||
    label.includes("mastercard") ||
    label.includes("machine") ||
    label.includes("unspecified card")
  ) {
    return "card";
  }

  return null;
}

function emptyTotals(): Record<PaymentSummaryKey, number> {
  return { cash: 0, card: 0, fonepay: 0, digital: 0, credit: 0 };
}

function applySalesFields(root: unknown, totals: Record<PaymentSummaryKey, number>) {
  if (!root || typeof root !== "object") return;
  const obj = root as Record<string, unknown>;
  for (const key of PAYMENT_SUMMARY_ORDER) {
    const field = SALES_FIELD_BY_KEY[key];
    if (obj[field] != null) {
      totals[key] = Math.max(totals[key], toAmount(obj[field]));
    }
  }
}

function readDistributionAmount(entry: unknown): number {
  if (!entry || typeof entry !== "object") return toAmount(entry);
  const row = entry as Record<string, unknown>;
  return toAmount(row.amount ?? row.total ?? row.value ?? row.sales);
}

function readDistributionLabel(entry: unknown): string {
  if (!entry || typeof entry !== "object") return "";
  const row = entry as Record<string, unknown>;
  return String(
    row.instrument ??
      row.method ??
      row.name ??
      row.payment_method ??
      row.label ??
      "",
  );
}

function aggregateDistributionList(list: unknown, totals: Record<PaymentSummaryKey, number>) {
  if (!Array.isArray(list)) return;
  for (const entry of list) {
    const label = readDistributionLabel(entry);
    const amount = readDistributionAmount(entry);
    if (amount <= 0) continue;

    const bucket = classifyPaymentLabel(label);
    if (bucket) {
      totals[bucket] += amount;
      continue;
    }

    const method = String((entry as Record<string, unknown>).method ?? "").toLowerCase();
    if (method && PAYMENT_SUMMARY_ORDER.includes(method as PaymentSummaryKey)) {
      totals[method as PaymentSummaryKey] += amount;
    }
  }
}

function aggregateObjectMap(map: unknown, totals: Record<PaymentSummaryKey, number>) {
  if (!map || typeof map !== "object" || Array.isArray(map)) return;
  for (const [name, value] of Object.entries(map as Record<string, unknown>)) {
    const amount = toAmount(value);
    if (amount <= 0) continue;
    const bucket = classifyPaymentLabel(name);
    if (bucket) totals[bucket] += amount;
  }
}

function aggregateInstrumentsFromSnapshot(snapshotData: unknown, totals: Record<PaymentSummaryKey, number>) {
  if (!snapshotData || typeof snapshotData !== "object") return;
  const data = snapshotData as Record<string, unknown>;

  aggregateDistributionList(data.payment_distribution, totals);
  aggregateDistributionList(data.payment_instrument_distribution, totals);
  aggregateDistributionList(data.payment_methods, totals);
  aggregateDistributionList(data.by_payment_method, totals);

  aggregateObjectMap(data.card_sales_by_instrument, totals);
  aggregateObjectMap(data.digital_sales_by_instrument, totals);
  aggregateObjectMap(data.manual_income_by_method, totals);

  const nested = data.payment_distribution;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    for (const [method, payload] of Object.entries(nested as Record<string, unknown>)) {
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const amount = toAmount((payload as Record<string, unknown>).amount);
        if (amount > 0) {
          const bucket =
            classifyPaymentLabel(method) ??
            (PAYMENT_SUMMARY_ORDER.includes(method as PaymentSummaryKey)
              ? (method as PaymentSummaryKey)
              : null);
          if (bucket) totals[bucket] += amount;
        }
      } else {
        const amount = toAmount(payload);
        if (amount > 0) {
          const bucket = classifyPaymentLabel(method);
          if (bucket) totals[bucket] += amount;
        }
      }
    }
  }
}

function snapshotRoots(snapshotData?: unknown): unknown[] {
  if (!snapshotData || typeof snapshotData !== "object") return [];
  const data = snapshotData as Record<string, unknown>;
  return [snapshotData, data.snapshot_data, data.financial_snapshot].filter(Boolean);
}

export function buildPaymentSummary(detail?: unknown, snapshotData?: unknown): PaymentSummaryLine[] {
  const totals = emptyTotals();

  applySalesFields(detail, totals);
  for (const root of snapshotRoots(snapshotData)) {
    applySalesFields(root, totals);
  }

  const hasSalesFields = PAYMENT_SUMMARY_ORDER.some((key) => totals[key] > 0);
  if (!hasSalesFields) {
    const instrumentTotals = emptyTotals();
    for (const root of snapshotRoots(snapshotData)) {
      aggregateInstrumentsFromSnapshot(root, instrumentTotals);
    }
    for (const key of PAYMENT_SUMMARY_ORDER) {
      totals[key] = instrumentTotals[key];
    }
  }

  return PAYMENT_SUMMARY_ORDER.map((key) => ({
    key,
    label: PAYMENT_SUMMARY_LABELS[key],
    amount: totals[key],
  }));
}

export function paymentSummaryGrandTotal(lines: PaymentSummaryLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

/** Hide verbose per-instrument rows when the grouped summary is shown. */
export function isPaymentBreakdownFlattenLabel(label: string): boolean {
  const normalized = String(label || "").toLowerCase();

  const sectionHints = [
    "payment instrument",
    "payment distribution",
    "payment methods",
    "by payment method",
    "grand totals by payment",
    "total settlement",
    "card sales by instrument",
    "digital sales by instrument",
    "manual income by method",
  ];
  if (sectionHints.some((hint) => normalized.includes(hint))) {
    return true;
  }

  if (
    normalized.includes("cash sales") ||
    normalized.includes("card sales") ||
    normalized.includes("digital sales") ||
    normalized.includes("fonepay sales") ||
    normalized.includes("credit sales")
  ) {
    return true;
  }

  const leaf = normalized.split("•").pop()?.trim() ?? normalized;
  return classifyPaymentLabel(leaf) != null;
}
