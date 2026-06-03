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

const PAYMENT_RECEIVED_EPSILON = 0.005;

/** True when this method received money (hide zero rows in day-close UI). */
export function hasPaymentReceived(amount: number): boolean {
  return Number.isFinite(amount) && amount > PAYMENT_RECEIVED_EPSILON;
}

type PaymentSettingRef = {
  name: string;
  payload?: string | null;
  identifier?: string | null;
};

function isGenericInstrumentName(name: string): boolean {
  const normalized = normalizeName(stripChannelSuffix(name));
  return (
    normalized === "unspecified" ||
    normalized === "unspecified qr" ||
    normalized === "unspecified card" ||
    normalized.startsWith("unspecified ")
  );
}

/** Backend default when checkout did not send instrument.name (day_close_service). */
function sumGenericInstrumentAmounts(instruments: Record<string, number>): number {
  let total = 0;
  for (const [instrumentName, amount] of Object.entries(instruments)) {
    if (isGenericInstrumentName(instrumentName)) {
      total += amount;
    }
  }
  return total;
}

function namedInstrumentsOnly(instruments: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [instrumentName, amount] of Object.entries(instruments)) {
    if (isGenericInstrumentName(instrumentName)) continue;
    if (!hasPaymentReceived(amount)) continue;
    out[instrumentName] = amount;
  }
  return out;
}

function instrumentMatchesSetting(instrumentName: string, setting: PaymentSettingRef): boolean {
  const inst = normalizeName(stripChannelSuffix(instrumentName));
  const target = normalizeName(setting.name);
  if (!inst || !target) return false;
  if (inst === target || inst.includes(target) || target.includes(inst)) return true;

  const identifier = normalizeName(setting.identifier || "");
  if (identifier && (inst.includes(identifier) || identifier.includes(inst))) return true;

  const payload = normalizeName(setting.payload || "");
  if (payload.length >= 6 && (inst.includes(payload) || payload.includes(inst))) return true;

  return false;
}

function significantNameTokens(name: string): string[] {
  const stopWords = new Set(["bank", "qr", "card", "pay", "pos", "machine", "digital"]);
  return normalizeName(name)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function bankTokenMatch(settingName: string, instrumentName: string): boolean {
  const displayName = stripChannelSuffix(settingName);
  if (instrumentMatchesSetting(instrumentName, { name: displayName })) return true;
  const instrument = normalizeName(instrumentName);
  return significantNameTokens(displayName).some((token) => instrument.includes(token));
}

function sumAmountForSetting(
  setting: PaymentSettingRef,
  instruments: Record<string, number>,
  usedKeys: Set<string>,
): number {
  let total = 0;
  for (const [instrumentName, amount] of Object.entries(instruments)) {
    if (usedKeys.has(instrumentName)) continue;
    if (instrumentMatchesSetting(instrumentName, setting) || bankTokenMatch(setting.name, instrumentName)) {
      total += amount;
      usedKeys.add(instrumentName);
    }
  }
  return total;
}

function stripChannelSuffix(label: string): string {
  return String(label || "")
    .trim()
    .replace(/\s*\(QR\)\s*$/i, "")
    .replace(/\s*\(Card\)\s*$/i, "")
    .trim();
}

/** Display label for static QR channels in day-close summaries. */
export function labelForQrChannel(qrName: string): string {
  const base = stripChannelSuffix(qrName);
  return base ? `${base} (QR)` : "QR payment";
}

function labelForCardChannel(cardName: string, staticQrs: Array<{ name: string }>): string {
  const base = stripChannelSuffix(cardName);
  const normalized = normalizeName(base);
  const duplicateQr = staticQrs.some((qr) => normalizeName(stripChannelSuffix(qr.name)) === normalized);
  return duplicateQr ? `${base} (Card)` : base;
}

/** Add per-bank QR/card rows; keep row sum aligned with authoritative bucket total. */
function appendInstrumentChannelRows(
  lines: PaymentSummaryLine[],
  settings: PaymentSettingRef[],
  instruments: Record<string, number>,
  bucketTotal: number,
  formatLabel: (name: string) => string,
  unallocatedKey: string,
  unallocatedLabel: string,
): void {
  if (bucketTotal <= PAYMENT_RECEIVED_EPSILON) {
    return;
  }

  const namedInstruments = namedInstrumentsOnly(instruments);
  const genericPool = sumGenericInstrumentAmounts(instruments);
  const usedKeys = new Set<string>();

  const channelRows: PaymentSummaryLine[] = settings.map((setting) => ({
    key: `${unallocatedKey}:${normalizeName(setting.name)}`,
    label: formatLabel(setting.name),
    amount: sumAmountForSetting(setting, namedInstruments, usedKeys),
  }));

  for (const [instrumentName, amount] of Object.entries(namedInstruments)) {
    if (usedKeys.has(instrumentName) || !hasPaymentReceived(amount)) continue;
    channelRows.push({
      key: `${unallocatedKey}:extra:${normalizeName(instrumentName)}`,
      label: formatLabel(instrumentName),
      amount,
    });
    usedKeys.add(instrumentName);
  }

  let assigned = channelRows.reduce((sum, row) => sum + row.amount, 0);
  const hasPerBankAmounts = channelRows.some((row) => hasPaymentReceived(row.amount));

  if (genericPool > PAYMENT_RECEIVED_EPSILON) {
    if (settings.length === 1) {
      channelRows[0].amount += genericPool;
      assigned += genericPool;
    }
  }

  const onlyUnrecordedSplit =
    !hasPerBankAmounts &&
    settings.length > 1 &&
    genericPool > PAYMENT_RECEIVED_EPSILON;

  if (onlyUnrecordedSplit) {
    lines.push({
      key: `${unallocatedKey}:unassigned`,
      label: unallocatedLabel,
      amount: genericPool,
    });
    const remainder = bucketTotal - genericPool;
    if (remainder > PAYMENT_RECEIVED_EPSILON) {
      lines.push({
        key: `${unallocatedKey}:remainder`,
        label: unallocatedLabel,
        amount: remainder,
      });
    }
    return;
  }

  if (genericPool > PAYMENT_RECEIVED_EPSILON && settings.length > 1) {
    channelRows.push({
      key: `${unallocatedKey}:generic`,
      label: unallocatedLabel,
      amount: genericPool,
    });
    assigned += genericPool;
  }

  if (assigned <= PAYMENT_RECEIVED_EPSILON) {
    if (bucketTotal > PAYMENT_RECEIVED_EPSILON) {
      lines.push({
        key: `${unallocatedKey}:unassigned`,
        label: unallocatedLabel,
        amount: bucketTotal,
      });
    }
    return;
  }

  const remainder = bucketTotal - assigned;
  if (remainder > PAYMENT_RECEIVED_EPSILON) {
    channelRows.push({
      key: `${unallocatedKey}:remainder`,
      label: unallocatedLabel,
      amount: remainder,
    });
  } else if (assigned > bucketTotal + PAYMENT_RECEIVED_EPSILON && assigned > 0) {
    const scale = bucketTotal / assigned;
    for (const row of channelRows) {
      row.amount *= scale;
    }
  }

  lines.push(...channelRows.filter((row) => hasPaymentReceived(row.amount)));
}

export function paymentSummaryHasUnrecordedInstruments(lines: PaymentSummaryLine[]): boolean {
  return lines.some(
    (line) =>
      line.key.includes(":unassigned") ||
      line.key.includes(":generic") ||
      /not recorded at checkout/i.test(line.label),
  );
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

function extractInstrumentMaps(detail?: unknown, snapshotData?: unknown) {
  const card: Record<string, number> = {};
  const digital: Record<string, number> = {};

  const roots = [detail, ...snapshotRoots(snapshotData)].filter(Boolean);
  for (const root of roots) {
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

/** Read backend `payment_distribution` once (no stacking with per-instrument rows). */
function readPaymentDistributionBuckets(
  root: Record<string, unknown>,
): Record<PaymentSummaryKey, number> | null {
  const dist = root.payment_distribution;
  if (!dist || typeof dist !== "object" || Array.isArray(dist)) return null;

  const totals = emptyTotals();
  let found = false;

  for (const method of PAYMENT_SUMMARY_ORDER) {
    const payload = (dist as Record<string, unknown>)[method];
    if (payload == null) continue;
    const amount =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? toAmount((payload as Record<string, unknown>).amount)
        : toAmount(payload);
    if (amount > PAYMENT_RECEIVED_EPSILON) {
      totals[method] = amount;
      found = true;
    }
  }

  return found ? totals : null;
}

function bucketTotalsAreEmpty(totals: Record<PaymentSummaryKey, number>): boolean {
  return PAYMENT_SUMMARY_ORDER.every((key) => totals[key] <= PAYMENT_RECEIVED_EPSILON);
}

/**
 * Authoritative per-method totals for the payment summary.
 * Uses day-close sales fields only — never sums payment_distribution + instrument maps
 * + manual income (that inflated Grand Total above Net Sales on Load Snapshot).
 */
function getBucketTotals(detail?: unknown, snapshotData?: unknown): Record<PaymentSummaryKey, number> {
  const totals = emptyTotals();

  applySalesFields(detail, totals);
  for (const root of snapshotRoots(snapshotData)) {
    if (!root || typeof root !== "object") continue;
    applySalesFields(root, totals);
    applyReceivablesCredit(root, totals);
  }

  if (bucketTotalsAreEmpty(totals)) {
    for (const root of snapshotRoots(snapshotData)) {
      if (!root || typeof root !== "object") continue;
      const fromDistribution = readPaymentDistributionBuckets(root as Record<string, unknown>);
      if (!fromDistribution) continue;
      for (const key of PAYMENT_SUMMARY_ORDER) {
        totals[key] = Math.max(totals[key], fromDistribution[key]);
      }
      break;
    }
  }

  return totals;
}

/** Net sales from day-close detail / snapshot (order revenue after refunds). */
export function resolveNetSalesAmount(detail?: unknown, snapshotData?: unknown): number {
  let net = 0;

  const readNet = (root: unknown) => {
    if (!root || typeof root !== "object") return;
    const value = toAmount((root as Record<string, unknown>).net_sales);
    if (value > net) net = value;
  };

  readNet(detail);
  for (const root of snapshotRoots(snapshotData)) {
    readNet(root);
  }

  return net;
}

/** Manual income posted outside orders (included in Total Income, not Net Sales). */
export function resolveManualIncomeTotal(snapshotData?: unknown): number {
  let manual = 0;

  const readManual = (root: unknown) => {
    if (!root || typeof root !== "object") return;
    const value = toAmount((root as Record<string, unknown>).manual_income_total);
    if (value > manual) manual = value;
  };

  for (const root of snapshotRoots(snapshotData)) {
    readManual(root);
  }

  return manual;
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
  const { card: cardInstruments, digital: digitalInstruments } = extractInstrumentMaps(
    detail,
    snapshotData,
  );
  const lines: PaymentSummaryLine[] = [];

  lines.push({ key: "cash", label: "Cash payment", amount: totals.cash });
  lines.push({ key: "credit", label: PAYMENT_SUMMARY_LABELS.credit, amount: totals.credit });

  if (settings.fonepayEnabled) {
    lines.push({
      key: "fonepay",
      label: PAYMENT_SUMMARY_LABELS.fonepay,
      amount: totals.fonepay,
    });
  }

  if (settings.staticQrs.length > 0) {
    appendInstrumentChannelRows(
      lines,
      settings.staticQrs,
      digitalInstruments,
      totals.digital,
      labelForQrChannel,
      "qr",
      "QR total (bank not recorded at checkout)",
    );
  } else if (hasPaymentReceived(totals.digital)) {
    lines.push({
      key: "digital",
      label: PAYMENT_SUMMARY_LABELS.digital,
      amount: totals.digital,
    });
  }

  if (settings.paymentCards.length > 0) {
    appendInstrumentChannelRows(
      lines,
      settings.paymentCards,
      cardInstruments,
      totals.card,
      (name) => labelForCardChannel(name, settings.staticQrs),
      "card",
      "Card total (terminal not recorded at checkout)",
    );
  } else if (hasPaymentReceived(totals.card)) {
    lines.push({ key: "card", label: PAYMENT_SUMMARY_LABELS.card, amount: totals.card });
  }

  return lines;
}

export function filterPaymentSummaryLinesWithReceipts(
  lines: PaymentSummaryLine[],
): PaymentSummaryLine[] {
  return lines.filter((line) => hasPaymentReceived(line.amount));
}

/** Cash / credit / Fonepay — always listed when settings-driven (even at Rs. 0). */
function isCorePaymentChannelLine(line: PaymentSummaryLine): boolean {
  return line.key === "cash" || line.key === "credit" || line.key === "fonepay";
}

/** Static QR / card rows from Manage → Settings → Payments (always show names). */
function isSettingsPaymentChannelLine(line: PaymentSummaryLine): boolean {
  const isConfiguredKey = (prefix: string) =>
    line.key.startsWith(`${prefix}:`) &&
    !line.key.includes(":generic") &&
    !line.key.includes(":remainder") &&
    !line.key.includes(":extra") &&
    !line.key.includes(":unassigned");

  return isConfiguredKey("qr") || isConfiguredKey("card");
}

export function buildPaymentSummary(
  detail?: unknown,
  snapshotData?: unknown,
  restaurant?: unknown,
): PaymentSummaryLine[] {
  const settings = parseRestaurantPaymentSettings(restaurant);
  const useSettingsChannels =
    settings &&
    (settings.fonepayEnabled || settings.staticQrs.length > 0 || settings.paymentCards.length > 0);

  const lines = useSettingsChannels
    ? buildSettingsDrivenPaymentSummary(detail, snapshotData, settings)
    : buildDefaultPaymentSummary(detail, snapshotData);

  if (useSettingsChannels) {
    return lines.filter(
      (line) =>
        hasPaymentReceived(line.amount) ||
        isCorePaymentChannelLine(line) ||
        isSettingsPaymentChannelLine(line),
    );
  }

  return filterPaymentSummaryLinesWithReceipts(lines);
}

/** Authoritative total from day-close sales fields (matches backend buckets). */
export function paymentSummaryBucketGrandTotal(
  detail?: unknown,
  snapshotData?: unknown,
): number {
  const totals = getBucketTotals(detail, snapshotData);
  return PAYMENT_SUMMARY_ORDER.reduce((sum, key) => sum + totals[key], 0);
}

/** Sum of displayed channel rows (may differ slightly before reconciliation). */
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
