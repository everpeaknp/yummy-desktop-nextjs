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

function normalizeName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

/** Map raw backend / instrument labels into the five POS payment buckets. */
export function classifyPaymentLabel(raw: string): PaymentSummaryKey | null {
  const label = normalizeName(raw);
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

function mergeInstrumentMap(target: Record<string, number>, source: Record<string, number>) {
  for (const [name, amount] of Object.entries(source)) {
    if (amount <= 0) continue;
    const key = String(name).trim();
    if (!key) continue;
    target[key] = (target[key] || 0) + amount;
  }
}

function objectMapToInstruments(map: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!map || typeof map !== "object" || Array.isArray(map)) return out;
  for (const [name, value] of Object.entries(map as Record<string, unknown>)) {
    const amount = toAmount(value);
    if (amount > 0) out[String(name)] = amount;
  }
  return out;
}

function listToInstrumentMap(
  list: unknown,
  methodFilter?: "card" | "digital",
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(list)) return out;

  for (const entry of list) {
    const amount = readDistributionAmount(entry);
    if (amount <= 0) continue;

    const method = String((entry as Record<string, unknown>).method ?? "").toLowerCase();
    const label = readDistributionLabel(entry);
    if (methodFilter && method && method !== methodFilter) continue;

    const instrumentName = label || method;
    if (!instrumentName) continue;
    out[instrumentName] = (out[instrumentName] || 0) + amount;
  }

  return out;
}

function extractInstrumentMaps(snapshotData?: unknown) {
  const card: Record<string, number> = {};
  const digital: Record<string, number> = {};

  for (const root of snapshotRoots(snapshotData)) {
    if (!root || typeof root !== "object") continue;
    const data = root as Record<string, unknown>;

    mergeInstrumentMap(card, objectMapToInstruments(data.card_sales_by_instrument));
    mergeInstrumentMap(digital, objectMapToInstruments(data.digital_sales_by_instrument));
    mergeInstrumentMap(card, listToInstrumentMap(data.payment_instrument_distribution, "card"));
    mergeInstrumentMap(digital, listToInstrumentMap(data.payment_instrument_distribution, "digital"));
  }

  return { card, digital };
}

function applyReceivablesCredit(root: unknown, totals: Record<PaymentSummaryKey, number>) {
  if (!root || typeof root !== "object") return;
  const receivables = (root as Record<string, unknown>).receivables;
  if (!receivables || typeof receivables !== "object") return;
  const creditSales = toAmount((receivables as Record<string, unknown>).credit_sales);
  if (creditSales > 0) {
    totals.credit = Math.max(totals.credit, creditSales);
  }
}

function getBucketTotals(detail?: unknown, snapshotData?: unknown): Record<PaymentSummaryKey, number> {
  const totals = emptyTotals();

  applySalesFields(detail, totals);
  for (const root of snapshotRoots(snapshotData)) {
    applySalesFields(root, totals);
    applyReceivablesCredit(root, totals);
  }

  const fromSnapshot = emptyTotals();
  for (const root of snapshotRoots(snapshotData)) {
    aggregateInstrumentsFromSnapshot(root, fromSnapshot);
    applyReceivablesCredit(root, fromSnapshot);
  }

  for (const key of PAYMENT_SUMMARY_ORDER) {
    totals[key] = Math.max(totals[key], fromSnapshot[key]);
  }

  const { card, digital } = extractInstrumentMaps(snapshotData);
  totals.card = Math.max(totals.card, sumInstrumentMap(card));
  totals.digital = Math.max(totals.digital, sumInstrumentMap(digital));

  return totals;
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
  const nested = data.snapshot_data;
  const nestedObj =
    nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;

  return [
    snapshotData,
    data.summary,
    data.detailed,
    data.financial_snapshot,
    data.snapshot_data,
    nestedObj?.financial_snapshot,
    nestedObj?.detailed,
  ].filter(Boolean);
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
        .filter((qr) => qr && typeof qr === "object")
        .map((qr) => {
          const row = qr as Record<string, unknown>;
          const name = String(row.name || "").trim();
          const payload = String(row.payload || "").trim();
          return name && payload ? { name, payload } : null;
        })
        .filter((qr): qr is { name: string; payload: string } => Boolean(qr))
    : [];

  const paymentCards = Array.isArray(r.payment_cards)
    ? (r.payment_cards as unknown[])
        .filter((card) => card && typeof card === "object")
        .map((card) => {
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

function pickInstrumentAmount(map: Record<string, number>, configuredName: string): number {
  const target = normalizeName(configuredName);
  if (!target) return 0;

  let exact = 0;
  let fuzzy = 0;
  for (const [instrumentName, amount] of Object.entries(map)) {
    const normalized = normalizeName(instrumentName);
    if (!normalized) continue;
    if (normalized === target) {
      exact += amount;
      continue;
    }
    if (normalized.includes(target) || target.includes(normalized)) {
      fuzzy += amount;
    }
  }

  return exact > 0 ? exact : fuzzy;
}

function sumInstrumentMap(map: Record<string, number>): number {
  return Object.values(map).reduce((sum, value) => sum + value, 0);
}

/** Ensure configured per-instrument rows still sum to the authoritative bucket total. */
function reconcileBucketLines(
  bucketTotal: number,
  lines: PaymentSummaryLine[],
  fallback: { key: string; label: string },
  other?: { key: string; label: string },
): PaymentSummaryLine[] {
  if (bucketTotal <= 0) {
    return lines.map((line) => ({ ...line, amount: 0 }));
  }

  const assigned = lines.reduce((sum, line) => sum + line.amount, 0);
  const remainder = Math.max(0, bucketTotal - assigned);

  if (lines.length === 0) {
    return [{ key: fallback.key, label: fallback.label, amount: bucketTotal }];
  }

  if (assigned <= 0) {
    return [{ key: fallback.key, label: fallback.label, amount: bucketTotal }];
  }

  if (remainder <= 0) {
    return lines;
  }

  const otherKey = other?.key ?? `${fallback.key}:other`;
  const otherLabel = other?.label ?? `Other ${fallback.label}`;
  const otherIndex = lines.findIndex((line) => line.key === otherKey);

  if (otherIndex >= 0) {
    const next = [...lines];
    next[otherIndex] = {
      ...next[otherIndex],
      amount: next[otherIndex].amount + remainder,
    };
    return next;
  }

  return [...lines, { key: otherKey, label: otherLabel, amount: remainder }];
}

function buildDefaultPaymentSummary(detail?: unknown, snapshotData?: unknown): PaymentSummaryLine[] {
  const totals = getBucketTotals(detail, snapshotData);
  return PAYMENT_SUMMARY_ORDER.map((key) => ({
    key,
    label: PAYMENT_SUMMARY_LABELS[key],
    amount: totals[key],
  }));
}

function buildSettingsDrivenPaymentSummary(
  detail: unknown,
  snapshotData: unknown,
  settings: RestaurantPaymentSettings,
): PaymentSummaryLine[] {
  const totals = getBucketTotals(detail, snapshotData);
  const { card: cardInstruments, digital: digitalInstruments } = extractInstrumentMaps(snapshotData);
  const lines: PaymentSummaryLine[] = [];
  const usedCardKeys = new Set<string>();
  const usedDigitalKeys = new Set<string>();

  lines.push({ key: "cash", label: PAYMENT_SUMMARY_LABELS.cash, amount: totals.cash });

  if (settings.paymentCards.length > 0) {
    const cardLines: PaymentSummaryLine[] = [];
    for (const card of settings.paymentCards) {
      const target = normalizeName(card.name);
      let amount = 0;
      for (const [instrumentName, instrumentAmount] of Object.entries(cardInstruments)) {
        const normalized = normalizeName(instrumentName);
        if (
          normalized === target ||
          normalized.includes(target) ||
          target.includes(normalized)
        ) {
          amount += instrumentAmount;
          usedCardKeys.add(instrumentName);
        }
      }
      cardLines.push({ key: `card:${target}`, label: card.name, amount });
    }

    const unmatchedCard = Object.entries(cardInstruments).reduce((sum, [name, amount]) => {
      if (usedCardKeys.has(name)) return sum;
      return sum + amount;
    }, 0);
    if (unmatchedCard > 0) {
      cardLines.push({ key: "card:other", label: "Other card", amount: unmatchedCard });
    }

    lines.push(
      ...reconcileBucketLines(totals.card, cardLines, {
        key: "card",
        label: PAYMENT_SUMMARY_LABELS.card,
      }),
    );
  } else {
    lines.push({ key: "card", label: PAYMENT_SUMMARY_LABELS.card, amount: totals.card });
  }

  if (settings.fonepayEnabled) {
    lines.push({
      key: "fonepay",
      label: PAYMENT_SUMMARY_LABELS.fonepay,
      amount: totals.fonepay,
    });
  }

  if (settings.staticQrs.length > 0) {
    const qrLines: PaymentSummaryLine[] = [];
    for (const qr of settings.staticQrs) {
      const target = normalizeName(qr.name);
      let amount = 0;
      for (const [instrumentName, instrumentAmount] of Object.entries(digitalInstruments)) {
        const normalized = normalizeName(instrumentName);
        if (
          normalized === target ||
          normalized.includes(target) ||
          target.includes(normalized)
        ) {
          amount += instrumentAmount;
          usedDigitalKeys.add(instrumentName);
        }
      }
      qrLines.push({ key: `qr:${target}`, label: qr.name, amount });
    }

    const unmatchedDigital = Object.entries(digitalInstruments).reduce((sum, [name, amount]) => {
      if (usedDigitalKeys.has(name)) return sum;
      return sum + amount;
    }, 0);
    if (unmatchedDigital > 0) {
      qrLines.push({ key: "digital:other", label: "Other Digital/QR", amount: unmatchedDigital });
    }

    lines.push(
      ...reconcileBucketLines(totals.digital, qrLines, {
        key: "digital",
        label: PAYMENT_SUMMARY_LABELS.digital,
      }),
    );
  } else if (totals.digital > 0) {
    lines.push({
      key: "digital",
      label: PAYMENT_SUMMARY_LABELS.digital,
      amount: totals.digital,
    });
  }

  lines.push({
    key: "credit",
    label: PAYMENT_SUMMARY_LABELS.credit,
    amount: totals.credit,
  });

  return lines;
}

export function buildPaymentSummary(
  detail?: unknown,
  snapshotData?: unknown,
  restaurant?: unknown,
): PaymentSummaryLine[] {
  const settings = parseRestaurantPaymentSettings(restaurant);
  if (!settings) {
    return buildDefaultPaymentSummary(detail, snapshotData);
  }

  const hasConfiguredMethods =
    settings.fonepayEnabled || settings.staticQrs.length > 0 || settings.paymentCards.length > 0;

  if (!hasConfiguredMethods) {
    return buildDefaultPaymentSummary(detail, snapshotData);
  }

  return buildSettingsDrivenPaymentSummary(detail, snapshotData, settings);
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
