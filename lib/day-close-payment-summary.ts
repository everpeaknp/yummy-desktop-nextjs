import {
  parseDayCloseSnapshotData,
  parsePaymentDistributionBucket,
  type DayCloseSnapshotData,
} from "@/types/day-close";

export type PaymentSummaryKey = "cash" | "card" | "fonepay" | "digital" | "credit";

export type PaymentSummaryLine = {
  key: string;
  label: string;
  amount: number;
};

export type RestaurantPaymentSettings = {
  fonepayEnabled: boolean;
  staticQrs: Array<{ name: string; payload: string }>;
  paymentCards: Array<{ name: string; identifier?: string | null }>;
};

export const PAYMENT_SUMMARY_ORDER: PaymentSummaryKey[] = [
  "cash",
  "card",
  "fonepay",
  "digital",
  "credit",
];

export const PAYMENT_SUMMARY_LABELS: Record<PaymentSummaryKey, string> = {
  cash: "Cash payment",
  card: "Card payment",
  fonepay: "Fonepay",
  digital: "Digital/QR",
  credit: "Credit payments",
};

const PAYMENT_RECEIVED_EPSILON = 0.005;

export function hasPaymentReceived(amount: number): boolean {
  return Number.isFinite(amount) && amount > PAYMENT_RECEIVED_EPSILON;
}

function resolveSnapshotData(snapshotData?: unknown): DayCloseSnapshotData | null {
  return parseDayCloseSnapshotData(snapshotData);
}

function readDetailNumber(detail: unknown, key: string): number | undefined {
  if (!detail || typeof detail !== "object") return undefined;
  const value = (detail as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/** Build payment rows from backend snapshot fields only. */
export function buildPaymentSummary(
  detail?: unknown,
  snapshotData?: unknown,
  _restaurant?: unknown,
): PaymentSummaryLine[] {
  const snapshot = resolveSnapshotData(snapshotData);
  const dist = snapshot?.payment_distribution;
  if (!dist) return [];

  const lines: PaymentSummaryLine[] = [];

  for (const key of PAYMENT_SUMMARY_ORDER) {
    const bucket = parsePaymentDistributionBucket(dist[key]);
    if (!bucket || !hasPaymentReceived(bucket.amount)) continue;
    lines.push({
      key,
      label: PAYMENT_SUMMARY_LABELS[key],
      amount: bucket.amount,
    });
  }

  for (const row of snapshot?.payment_instrument_distribution ?? []) {
    const method = String(row.method ?? "").toLowerCase();
    if (method !== "card" && method !== "digital") continue;
    if (!hasPaymentReceived(row.amount)) continue;
    lines.push({
      key: `${method}:${row.instrument}`,
      label: `${row.instrument} (${method === "card" ? "Card" : "Digital/QR"})`,
      amount: row.amount,
    });
  }

  return lines;
}

export function filterPaymentSummaryLinesWithReceipts(
  lines: PaymentSummaryLine[],
): PaymentSummaryLine[] {
  return lines.filter((line) => hasPaymentReceived(line.amount));
}

/** @deprecated Prefer displaying backend net_sales; bucket sums are not authoritative. */
export function paymentSummaryBucketGrandTotal(
  _detail?: unknown,
  _snapshotData?: unknown,
): number {
  return 0;
}

export function paymentSummaryGrandTotal(_lines: PaymentSummaryLine[]): number {
  return 0;
}

export function paymentSummaryHasUnrecordedInstruments(_lines: PaymentSummaryLine[]): boolean {
  return false;
}

export function resolveNetSalesAmount(detail?: unknown, snapshotData?: unknown): number | undefined {
  const snapshot = resolveSnapshotData(snapshotData);
  if (snapshot?.net_sales != null) return snapshot.net_sales;
  return readDetailNumber(detail, "net_sales");
}

export function resolveManualIncomeTotal(snapshotData?: unknown): number | undefined {
  const snapshot = resolveSnapshotData(snapshotData);
  return snapshot?.manual_income_total;
}

export function classifyPaymentLabel(raw: string): PaymentSummaryKey | null {
  const label = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

  if (label.includes("fonepay") || label.includes("fone pay")) return "fonepay";
  if (
    label.includes("city ledger") ||
    (label.includes("credit") &&
      !label.includes("card") &&
      !label.includes("collection") &&
      !label.includes("machine"))
  ) {
    return "credit";
  }
  if (label === "cash" || (label.includes("cash") && !label.includes("fonepay"))) return "cash";
  if (
    label.includes("digital") ||
    label.includes(" qr") ||
    label.startsWith("qr") ||
    label.includes("wallet")
  ) {
    return "digital";
  }
  if (label.includes("card") || label.includes("debit") || label.includes("visa")) return "card";
  return null;
}

export function labelForQrChannel(qrName: string): string {
  const base = String(qrName || "")
    .trim()
    .replace(/\s*\(QR\)\s*$/i, "")
    .replace(/\s*\(Card\)\s*$/i, "")
    .trim();
  return base ? `${base} (QR)` : "QR payment";
}

export function parseRestaurantPaymentSettings(restaurant: unknown): RestaurantPaymentSettings | null {
  if (!restaurant || typeof restaurant !== "object") return null;
  const r = restaurant as Record<string, unknown>;
  const fonepayConfig =
    r.fonepay_config && typeof r.fonepay_config === "object"
      ? (r.fonepay_config as Record<string, unknown>)
      : null;

  const staticQrs = Array.isArray(r.payment_qrs)
    ? (r.payment_qrs as unknown[])
        .map((qr) => {
          if (!qr || typeof qr !== "object") return null;
          const row = qr as Record<string, unknown>;
          const name = String(row.name || "").trim();
          const payload = String(row.payload || "").trim();
          return name && payload ? { name, payload } : null;
        })
        .filter((qr): qr is { name: string; payload: string } => Boolean(qr))
    : [];

  const paymentCards = Array.isArray(r.payment_cards)
    ? (r.payment_cards as unknown[])
        .map((card) => {
          if (!card || typeof card !== "object") return null;
          const row = card as Record<string, unknown>;
          const name = String(row.name || "").trim();
          if (!name) return null;
          const identifier = row.identifier != null ? String(row.identifier).trim() : null;
          return { name, identifier: identifier || null };
        })
        .filter((card): card is { name: string; identifier: string | null } => Boolean(card))
    : [];

  return {
    fonepayEnabled: Boolean(r.fonepay_enabled ?? fonepayConfig?.is_active ?? false),
    staticQrs,
    paymentCards,
  };
}

export function isPaymentBreakdownFlattenLabel(label: string): boolean {
  const normalized = String(label || "").toLowerCase();
  const sectionHints = [
    "payment instrument",
    "payment distribution",
    "payment methods",
    "by payment method",
    "card sales by instrument",
    "digital sales by instrument",
  ];
  if (sectionHints.some((hint) => normalized.includes(hint))) return true;
  const leaf = normalized.split("•").pop()?.trim() ?? normalized;
  return classifyPaymentLabel(leaf) != null;
}
