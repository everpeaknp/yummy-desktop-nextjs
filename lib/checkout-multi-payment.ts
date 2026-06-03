export type CheckoutPaymentMethod =
  | "cash"
  | "card"
  | "digital"
  | "credit"
  | "fonepay";

export type CheckoutPaymentRow = {
  id: string;
  method: CheckoutPaymentMethod;
  amount: string;
  reference: string;
  selectedQrIndex: number;
  selectedCardIndex: number;
  customerId: string;
};

export type PaymentInstrumentPayload = {
  type: string;
  name: string;
  meta?: Record<string, unknown>;
};

export type RowValidationErrors = Record<string, Partial<Record<keyof CheckoutPaymentRow | "amount" | "method" | "customerId" | "instrument", string>>>;

let rowIdCounter = 0;

export function createPaymentRow(
  partial?: Partial<CheckoutPaymentRow>
): CheckoutPaymentRow {
  rowIdCounter += 1;
  return {
    id: `pay-row-${rowIdCounter}`,
    method: "cash",
    amount: "",
    reference: "",
    selectedQrIndex: 0,
    selectedCardIndex: 0,
    customerId: "",
    ...partial,
  };
}

export function parseRowAmount(amount: string): number {
  const n = parseFloat(String(amount).trim());
  return Number.isFinite(n) ? n : 0;
}

export function sumPaymentRowAmounts(rows: CheckoutPaymentRow[]): number {
  return rows.reduce((sum, row) => sum + parseRowAmount(row.amount), 0);
}

export function computeRemaining(balanceDue: number, rows: CheckoutPaymentRow[]): number {
  const total = sumPaymentRowAmounts(rows);
  return Math.max(0, Number((balanceDue - total).toFixed(2)));
}

export function buildPaymentInstrument(
  method: CheckoutPaymentMethod,
  qrIndex: number,
  cardIndex: number,
  staticPaymentQrs: Array<{ name: string; payload: string }>,
  staticPaymentCards: Array<{ name: string; identifier?: string | null }>
): PaymentInstrumentPayload | null {
  if (method === "digital") {
    const selected = staticPaymentQrs[qrIndex];
    if (!selected) return null;
    return {
      type: "static_qr",
      name: selected.name,
      meta: { payload: selected.payload, index: qrIndex },
    };
  }
  if (method === "card") {
    const selected = staticPaymentCards[cardIndex];
    if (!selected) return null;
    return {
      type: "card",
      name: selected.name,
      meta: { identifier: selected.identifier || null, index: cardIndex },
    };
  }
  return null;
}

export type ValidatePaymentRowsInput = {
  rows: CheckoutPaymentRow[];
  balanceDue: number;
  orderCustomerId?: number | null;
  staticPaymentQrs: Array<{ name: string; payload: string }>;
  staticPaymentCards: Array<{ name: string; identifier?: string | null }>;
};

export type ValidatePaymentRowsResult = {
  valid: boolean;
  globalError: string | null;
  rowErrors: RowValidationErrors;
  total: number;
  remaining: number;
};

export function validatePaymentRows(
  input: ValidatePaymentRowsInput
): ValidatePaymentRowsResult {
  const { rows, balanceDue, orderCustomerId, staticPaymentQrs, staticPaymentCards } =
    input;
  const rowErrors: RowValidationErrors = {};
  let globalError: string | null = null;

  if (rows.length === 0) {
    return {
      valid: false,
      globalError: "Add at least one payment row",
      rowErrors,
      total: 0,
      remaining: balanceDue,
    };
  }

  const total = sumPaymentRowAmounts(rows);
  const remaining = computeRemaining(balanceDue, rows);

  if (total <= 0) {
    globalError = "Enter at least one payment amount greater than zero";
  } else if (total > balanceDue + 0.009) {
    globalError = `Total payments (${total.toFixed(2)}) cannot exceed balance due (${balanceDue.toFixed(2)})`;
  }

  const hasFonepay = rows.some((r) => r.method === "fonepay");
  if (hasFonepay && rows.length > 1) {
    globalError =
      globalError ||
      "Fonepay must be the only payment when using Multiple Payment (or use single payment mode)";
  }

  for (const row of rows) {
    const errs: RowValidationErrors[string] = {};
    const amount = parseRowAmount(row.amount);

    if (amount <= 0) {
      errs.amount = "Amount must be greater than zero";
    }

    if (row.method === "fonepay" && rows.length > 1) {
      errs.method = "Fonepay cannot be combined with other rows";
    }

    if (row.method === "credit") {
      const customerId =
        orderCustomerId || (row.customerId ? parseInt(row.customerId, 10) : null);
      if (!customerId || !Number.isFinite(customerId)) {
        errs.customerId = "Select a customer for credit";
      }
    }

    if (row.method === "digital" && staticPaymentQrs.length === 0) {
      errs.instrument = "No static QR configured in settings";
    }

    if (row.method === "card" && staticPaymentCards.length === 0) {
      errs.instrument = "No card account configured in settings";
    }

    if (Object.keys(errs).length > 0) {
      rowErrors[row.id] = errs;
    }
  }

  const valid =
    !globalError &&
    Object.keys(rowErrors).length === 0 &&
    total > 0 &&
    total <= balanceDue + 0.009;

  return { valid, globalError, rowErrors, total, remaining };
}

export function buildPaymentPayload(
  row: CheckoutPaymentRow,
  balanceDue: number,
  orderCustomerId: number | undefined,
  staticPaymentQrs: Array<{ name: string; payload: string }>,
  staticPaymentCards: Array<{ name: string; identifier?: string | null }>
) {
  const rawAmount = parseRowAmount(row.amount);
  const amount = Math.min(rawAmount, balanceDue);
  const instrument = buildPaymentInstrument(
    row.method,
    row.selectedQrIndex,
    row.selectedCardIndex,
    staticPaymentQrs,
    staticPaymentCards
  );

  const customerId =
    row.method === "credit"
      ? orderCustomerId || (row.customerId ? parseInt(row.customerId, 10) : undefined)
      : undefined;

  return {
    payment: {
      method: row.method,
      amount,
      reference: row.reference.trim() || null,
      instrument,
      status: "success" as const,
      ...(customerId ? { customer_id: customerId } : {}),
    },
  };
}
