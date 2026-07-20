/** Backend-driven day close types — financial values are authoritative from API only. */

export type BusinessLine = "restaurant" | "hotel";

export type DayCloseStatus = "open" | "pending" | "confirmed" | "reopened" | string;

export type DrawerSessionStatus =
  | "draft"
  | "opened"
  | "closing_count_required"
  | "closed"
  | "variance_review_required"
  | "approved"
  | "reopened"
  | string;

export interface DrawerConfiguration {
  id: number;
  restaurant_id: number;
  business_line: BusinessLine | string;
  station: string;
  drawer_key: string;
  name: string;
  standard_float: number;
  opening_variance_tolerance: number;
  closing_variance_tolerance: number;
  blind_count_enabled: boolean;
  is_active: boolean;
}

export interface DrawerCashier {
  id: number;
  name: string;
  email: string;
  role?: string | null;
}

export interface DrawerAssignment {
  id: number;
  configuration_id: number;
  restaurant_id: number;
  business_line: BusinessLine | string;
  station: string;
  drawer_key: string;
  cashier_id: number;
  assigned_by_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DrawerOpeningSuggestion {
  configuration_id: number;
  amount: number;
  source: string;
  opening_variance_tolerance: number;
  opening_variance_enforced: boolean;
}

export interface DrawerClosingPrompt {
  session_id: number;
  blind_count_enabled: boolean;
  expected_closing_cash?: number | null;
}

export interface DrawerSessionOpenInput {
  restaurant_id: number;
  business_line?: BusinessLine | string;
  station: string;
  drawer_key: string;
  business_date: string;
  counted_opening_cash: number;
  denominations_json?: Record<string, unknown> | null;
  reason?: string | null;
  approved_by_id?: number | null;
  opening_difference_source?: string | null;
  opening_difference_destination?: string | null;
  opening_difference_reference?: string | null;
}

export interface DrawerClosingCountInput {
  counted_closing_cash: number;
  denominations_json?: Record<string, unknown> | null;
  reason?: string | null;
}

export interface DrawerVarianceApprovalInput {
  reason: string;
  retained_float: number;
}

export interface DrawerSettlementDecisionInput {
  reason: string;
  retained_float: number;
  settlement_mode: "safe_transfer" | "pending_bank_deposit" | "immediate_bank_deposit" | "retain_all" | string;
  settlement_amount: number;
  settlement_destination?: string | null;
  settlement_reference?: string | null;
}

export interface DrawerMovement {
  id: number;
  source_key: string;
  movement_type: string;
  signed_amount: number;
  payment_method?: string | null;
  occurred_at?: string | null;
  recorded_by_id?: number | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface DrawerCount {
  id: number;
  count_type: string;
  total_amount: number;
  denominations_json?: Record<string, unknown> | null;
  counted_by_id?: number | null;
  counted_at?: string | null;
}

export interface DrawerExpectedBreakdown {
  session_id: number;
  opening_float: number;
  cash_sales: number;
  manual_income: number;
  receivable_collections: number;
  refunds: number;
  expenses: number;
  inventory_payments: number;
  supplier_payments: number;
  cash_drops: number;
  transfers_in: number;
  transfers_out: number;
  drops_transfers: number;
  adjustments: number;
  cash_in: number;
  cash_out: number;
  movement_total: number;
  expected_cash: number;
  counted_cash?: number | null;
  variance?: number | null;
  movements?: DrawerMovement[];
}

export interface DrawerSession {
  id: number;
  configuration_id: number;
  restaurant_id: number;
  day_close_id?: number | null;
  business_line: BusinessLine | string;
  station: string;
  drawer_key: string;
  cashier_id?: number | null;
  cashier_name?: string | null;
  business_date: string;
  status: DrawerSessionStatus;
  suggested_opening_source?: string | null;
  suggested_opening_cash?: number | null;
  counted_opening_cash?: number | null;
  opening_variance?: number | null;
  expected_closing_cash?: number | null;
  counted_closing_cash?: number | null;
  cash_variance?: number | null;
  retained_float?: number | null;
  settlement_mode?: string | null;
  settlement_amount?: number | null;
  settlement_destination?: string | null;
  settlement_reference?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  approved_at?: string | null;
  movements?: DrawerMovement[];
  counts?: DrawerCount[];
}

export interface DrawerActivityLog {
  id: string;
  activity_type: string;
  title: string;
  description?: string | null;
  amount?: number | null;
  occurred_at: string;
  actor_id?: number | null;
  actor_name?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DrawerSessionHistoryPage {
  items: DrawerSession[];
  total: number;
  skip: number;
  limit: number;
}

export interface DayCloseDrawerControlRow {
  session_id?: number | null;
  configuration_id?: number | null;
  station?: string | null;
  drawer_key?: string | null;
  name?: string | null;
  cashier_id?: number | null;
  status?: string | null;
  suggested_opening_source?: string | null;
  suggested_opening_cash?: number | null;
  counted_opening_cash?: number | null;
  expected_closing_cash?: number | null;
  counted_closing_cash?: number | null;
  cash_variance?: number | null;
  retained_float?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
  approved_by_id?: number | null;
  approved_at?: string | null;
  is_current_session?: boolean;
  boundary_inferred?: boolean;
}

export interface DayCloseDrawerControl {
  enabled?: boolean;
  opening_required?: boolean;
  opening_cash?: number;
  expected_cash?: number;
  counted_cash?: number | null;
  cash_variance?: number | null;
  boundary_inferred?: boolean;
  drawers?: DayCloseDrawerControlRow[];
}

export interface DayCloseAccountingReviewSummary {
  id?: number;
  day_close_id?: number;
  status?: string;
  blockers?: string[];
  suspense_amount?: number;
  unposted_event_count?: number;
  mapping_exception_count?: number;
  reviewed_at?: string | null;
}

export interface PaymentDistributionBucket {
  count?: number;
  amount: number;
}

export interface PaymentInstrumentRow {
  method: string;
  instrument: string;
  count?: number;
  amount: number;
}

export interface CreditSettlementOrder {
  order_id: number;
  restaurant_order_id?: number;
  customer_name?: string;
  table_name?: string;
  channel?: string;
  status?: string;
  grand_total?: number;
  credit_amount?: number;
  payment_methods?: string[];
  created_at?: string;
  completed_at?: string;
}

export interface CreditSettlement {
  customers_count?: number;
  orders_count?: number;
  amount?: number;
  orders?: CreditSettlementOrder[];
}

export interface HotelRevenueSplit {
  room_revenue?: number;
  food_revenue?: number;
}

export interface DayCloseRefundsSnapshot {
  count?: number;
  total?: number;
  cash_refunds?: number;
  card_refunds?: number;
  digital_refunds?: number;
  fonepay_refunds?: number;
  entries?: unknown[];
}

export interface DayCloseReceivablesSnapshot {
  credit_sales?: number;
  credit_orders_count?: number;
  credit_collections?: number;
  cash_credit_collections?: number;
  outstanding_receivables?: number;
  credit_collections_by_method?: Record<string, unknown>;
}

export interface DayCloseSnapshotData {
  period_start_at?: string;
  period_end_at?: string;
  business_date?: string;
  business_line?: BusinessLine | string;
  opening_balance?: number;
  hotel_revenue_split?: HotelRevenueSplit;
  payment_distribution?: Partial<
    Record<"cash" | "card" | "digital" | "fonepay" | "credit", PaymentDistributionBucket | number>
  >;
  payment_instrument_distribution?: PaymentInstrumentRow[];
  card_sales_by_instrument?: Record<string, number>;
  digital_sales_by_instrument?: Record<string, number>;
  credit_settlement?: CreditSettlement;
  expenses?: unknown[];
  expense_breakdown?: Record<string, unknown>;
  expense_total?: number;
  manual_income_total?: number;
  manual_cash_income?: number;
  gross_sales?: number;
  net_sales?: number;
  total_income?: number;
  expected_cash?: number;
  drawer_control?: DayCloseDrawerControl;
  cash_collected?: number;
  operational_snapshot?: Record<string, unknown>;
  receivables?: DayCloseReceivablesSnapshot;
  refunds?: DayCloseRefundsSnapshot;
  paid_purchase_total?: number;
  paid_purchase_count?: number;
  pending_purchase_total?: number;
  pending_purchase_count?: number;
  drawer_sessions?: unknown[];
  drawer_evidence?: unknown[];
  orders?: unknown[];
  sales_by_category?: unknown;
  sales_by_table?: unknown;
  category_details?: unknown[];
  table_details?: unknown[];
  [key: string]: unknown;
}

export interface DayCloseSnapshotResponse {
  snapshot_data?: DayCloseSnapshotData | null;
  generated_at?: string;
}

export interface DayCloseDetail {
  id: number;
  restaurant_id: number;
  business_date?: string;
  business_line?: BusinessLine | string;
  period_start_at?: string;
  period_end_at?: string;
  status: DayCloseStatus;
  total_orders?: number;
  completed_orders?: number;
  canceled_orders?: number;
  opening_balance?: number;
  gross_sales?: number;
  discount_total?: number;
  tax_total?: number;
  service_charge_total?: number;
  net_sales?: number;
  total_income?: number;
  cash_sales?: number;
  card_sales?: number;
  digital_sales?: number;
  fonepay_sales?: number;
  credit_sales?: number;
  credit_collections?: number;
  manual_cash_income?: number;
  outstanding_receivables?: number;
  expense_count?: number;
  expense_total?: number;
  refund_count?: number;
  refund_total?: number;
  expected_cash?: number;
  actual_cash?: number;
  cash_discrepancy?: number;
  net_cash_position?: number;
  confirmed_at?: string;
  confirmation_notes?: string | null;
  timezone?: string;
  accounting_review?: DayCloseAccountingReviewSummary | null;
  accounting_status?: Record<string, unknown> | null;
}

export interface DayCloseListItem {
  id: number;
  business_date?: string;
  business_line?: BusinessLine | string;
  status: DayCloseStatus;
  period_start_at?: string;
  period_end_at?: string;
  net_sales?: number;
  expected_cash?: number;
  actual_cash?: number;
  total_orders?: number;
  timezone?: string;
}

/** Confirmed close window from GET /day-closes/sessions (analytics/history filters). */
export interface DayCloseSession {
  id: number;
  business_date?: string;
  business_line?: BusinessLine | string;
  confirmed_at?: string;
  period_start_at?: string;
  period_end_at?: string;
  timezone?: string;
}

export interface DayCloseCurrent {
  id?: number;
  business_date?: string;
  business_line?: BusinessLine | string;
  status?: DayCloseStatus;
  action_label?: string;
  period_start_at?: string;
  period_end_at?: string;
  snapshot_preview?: DayCloseSnapshotData | null;
  timezone?: string;
}

export interface DayCloseValidateResult {
  can_close: boolean;
  active_orders_count?: number;
  pending_refunds_count?: number;
  blockers?: string[];
  warnings?: string[];
}

/** Merge generate-snapshot summary root with nested `detailed` breakdown. */
function mergeSnapshotPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const detailed = asRecord(raw.detailed);
  if (!detailed) return raw;
  const { detailed: _omit, ...summary } = raw;
  return { ...detailed, ...summary };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readNumeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readAmount(value: unknown): number | undefined {
  const direct = readNumeric(value);
  if (direct !== undefined) return direct;
  const row = asRecord(value);
  if (!row) return undefined;
  return readNumeric(row.amount);
}

export function parsePaymentDistributionBucket(
  value: unknown
): PaymentDistributionBucket | undefined {
  if (value == null) return undefined;
  const amount = readAmount(value);
  if (amount === undefined) return undefined;
  const row = asRecord(value);
  const count =
    row && typeof row.count === "number" && Number.isFinite(row.count)
      ? row.count
      : undefined;
  return { amount, count };
}

export function parseDayCloseSnapshotData(payload: unknown): DayCloseSnapshotData | null {
  const root = asRecord(payload);
  if (!root) return null;

  const nested = root.snapshot_data ?? root;
  const raw = asRecord(nested);
  if (!raw) return null;
  const data = mergeSnapshotPayload(raw);

  const payment_distribution: DayCloseSnapshotData["payment_distribution"] = {};
  for (const key of ["cash", "card", "digital", "fonepay", "credit"] as const) {
    const bucket = parsePaymentDistributionBucket(data[key] ?? asRecord(data.payment_distribution)?.[key]);
    if (bucket) payment_distribution[key] = bucket;
  }
  const distObj = asRecord(data.payment_distribution);
  if (distObj) {
    for (const key of ["cash", "card", "digital", "fonepay", "credit"] as const) {
      const bucket = parsePaymentDistributionBucket(distObj[key]);
      if (bucket) payment_distribution[key] = bucket;
    }
  }

  const instrumentsRaw = data.payment_instrument_distribution;
  let payment_instrument_distribution: PaymentInstrumentRow[] | undefined;
  if (Array.isArray(instrumentsRaw)) {
    const parsed: PaymentInstrumentRow[] = [];
    for (const row of instrumentsRaw) {
      const r = asRecord(row);
      if (!r) continue;
      const amount = readAmount(r.amount);
      if (amount === undefined) continue;
      parsed.push({
        method: String(r.method ?? ""),
        instrument: String(r.instrument ?? r.name ?? ""),
        count: typeof r.count === "number" ? r.count : undefined,
        amount,
      });
    }
    payment_instrument_distribution = parsed.length > 0 ? parsed : undefined;
  }

  const creditRaw = asRecord(data.credit_settlement);
  let credit_settlement: CreditSettlement | undefined;
  if (creditRaw) {
    credit_settlement = {
      customers_count:
        typeof creditRaw.customers_count === "number" ? creditRaw.customers_count : undefined,
      orders_count:
        typeof creditRaw.orders_count === "number" ? creditRaw.orders_count : undefined,
      amount: readAmount(creditRaw.amount),
      orders: Array.isArray(creditRaw.orders)
        ? (creditRaw.orders as CreditSettlementOrder[])
        : undefined,
    };
  }

  const hotelRaw = asRecord(data.hotel_revenue_split);
  const hotel_revenue_split = hotelRaw
    ? {
        room_revenue: readAmount(hotelRaw.room_revenue),
        food_revenue: readAmount(hotelRaw.food_revenue),
      }
    : undefined;

  const receivablesRaw = asRecord(data.receivables);
  const receivables: DayCloseReceivablesSnapshot | undefined = receivablesRaw
    ? {
        credit_sales: readAmount(receivablesRaw.credit_sales),
        credit_orders_count:
          typeof receivablesRaw.credit_orders_count === "number"
            ? receivablesRaw.credit_orders_count
            : undefined,
        credit_collections: readAmount(receivablesRaw.credit_collections),
        cash_credit_collections: readAmount(receivablesRaw.cash_credit_collections),
        outstanding_receivables: readAmount(receivablesRaw.outstanding_receivables),
        credit_collections_by_method:
          receivablesRaw.credit_collections_by_method &&
          typeof receivablesRaw.credit_collections_by_method === "object"
            ? (receivablesRaw.credit_collections_by_method as Record<string, unknown>)
            : undefined,
      }
    : undefined;

  const refundsRaw = asRecord(data.refunds);
  const refunds: DayCloseRefundsSnapshot | undefined = refundsRaw
    ? {
        count: typeof refundsRaw.count === "number" ? refundsRaw.count : undefined,
        total: readAmount(refundsRaw.total),
        cash_refunds: readAmount(refundsRaw.cash_refunds),
        card_refunds: readAmount(refundsRaw.card_refunds),
        digital_refunds: readAmount(refundsRaw.digital_refunds),
        fonepay_refunds: readAmount(refundsRaw.fonepay_refunds),
        entries: Array.isArray(refundsRaw.entries) ? refundsRaw.entries : undefined,
      }
    : undefined;

  return {
    ...data,
    period_start_at: data.period_start_at != null ? String(data.period_start_at) : undefined,
    period_end_at: data.period_end_at != null ? String(data.period_end_at) : undefined,
    business_date: data.business_date != null ? String(data.business_date) : undefined,
    business_line: data.business_line != null ? String(data.business_line) : undefined,
    opening_balance: readAmount(data.opening_balance),
    payment_distribution: Object.keys(payment_distribution).length ? payment_distribution : undefined,
    payment_instrument_distribution,
    credit_settlement,
    hotel_revenue_split,
    receivables,
    refunds,
    paid_purchase_total: readAmount(data.paid_purchase_total),
    paid_purchase_count:
      typeof data.paid_purchase_count === "number" ? data.paid_purchase_count : undefined,
    pending_purchase_total: readAmount(data.pending_purchase_total),
    pending_purchase_count:
      typeof data.pending_purchase_count === "number"
        ? data.pending_purchase_count
        : undefined,
    expenses: Array.isArray(data.expenses) ? data.expenses : undefined,
    expense_breakdown:
      data.expense_breakdown && typeof data.expense_breakdown === "object"
        ? (data.expense_breakdown as Record<string, unknown>)
        : undefined,
    gross_sales: readAmount(data.gross_sales),
    net_sales: readAmount(data.net_sales),
    expense_total: readAmount(data.expense_total),
    total_income: readAmount(data.total_income),
    expected_cash: readAmount(data.expected_cash),
    cash_collected: readAmount(data.cash_collected),
    manual_income_total: readAmount(data.manual_income_total),
    manual_cash_income: readAmount(data.manual_cash_income),
  };
}

export function parseDayCloseSnapshotResponse(payload: unknown): DayCloseSnapshotResponse | null {
  const root = asRecord(payload);
  if (!root) return null;
  const snapshot_data = parseDayCloseSnapshotData(root.snapshot_data ?? root);
  return {
    snapshot_data,
    generated_at: root.generated_at != null ? String(root.generated_at) : undefined,
  };
}

export function parseDayCloseDetail(payload: unknown): DayCloseDetail | null {
  const row = asRecord(payload);
  if (!row) return null;
  const id = Number(row.id);
  const restaurant_id = Number(row.restaurant_id);
  if (!Number.isFinite(id) || !Number.isFinite(restaurant_id)) return null;

  const numericFields = [
    "total_orders",
    "completed_orders",
    "canceled_orders",
    "opening_balance",
    "gross_sales",
    "discount_total",
    "tax_total",
    "service_charge_total",
    "net_sales",
    "total_income",
    "cash_sales",
    "card_sales",
    "digital_sales",
    "fonepay_sales",
    "credit_sales",
    "credit_collections",
    "manual_cash_income",
    "outstanding_receivables",
    "expense_count",
    "expense_total",
    "refund_count",
    "refund_total",
    "expected_cash",
    "actual_cash",
    "cash_discrepancy",
    "net_cash_position",
  ] as const;

  const detail: DayCloseDetail = {
    id,
    restaurant_id,
    status: String(row.status ?? "open"),
    business_date: row.business_date != null ? String(row.business_date) : undefined,
    business_line: row.business_line != null ? String(row.business_line) : undefined,
    period_start_at: row.period_start_at != null ? String(row.period_start_at) : undefined,
    period_end_at: row.period_end_at != null ? String(row.period_end_at) : undefined,
    confirmed_at: row.confirmed_at != null ? String(row.confirmed_at) : undefined,
    confirmation_notes:
      row.confirmation_notes === null || row.confirmation_notes === undefined
        ? row.confirmation_notes
        : String(row.confirmation_notes),
    timezone: row.timezone != null ? String(row.timezone) : undefined,
    accounting_review:
      row.accounting_review && typeof row.accounting_review === "object"
        ? (row.accounting_review as DayCloseAccountingReviewSummary)
        : null,
    accounting_status:
      row.accounting_status && typeof row.accounting_status === "object"
        ? (row.accounting_status as Record<string, unknown>)
        : null,
  };

  for (const key of numericFields) {
    const value = readNumeric(row[key]);
    if (value !== undefined) {
      (detail as unknown as Record<string, unknown>)[key] = value;
    }
  }

  return detail;
}

export function parseDayCloseListItem(payload: unknown): DayCloseListItem | null {
  const row = asRecord(payload);
  if (!row) return null;
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;

  const item: DayCloseListItem = {
    id,
    status: String(row.status ?? "open"),
    business_date: row.business_date != null ? String(row.business_date) : undefined,
    business_line: row.business_line != null ? String(row.business_line) : undefined,
    period_start_at: row.period_start_at != null ? String(row.period_start_at) : undefined,
    period_end_at: row.period_end_at != null ? String(row.period_end_at) : undefined,
    timezone: row.timezone != null ? String(row.timezone) : undefined,
  };

  for (const key of ["net_sales", "expected_cash", "actual_cash", "total_orders"] as const) {
    const value = readNumeric(row[key]);
    if (value !== undefined) {
      item[key] = value;
    }
  }

  return item;
}

export function parseDayCloseSession(payload: unknown): DayCloseSession | null {
  const row = asRecord(payload);
  if (!row) return null;
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    business_date: row.business_date != null ? String(row.business_date) : undefined,
    business_line: row.business_line != null ? String(row.business_line) : undefined,
    confirmed_at: row.confirmed_at != null ? String(row.confirmed_at) : undefined,
    period_start_at: row.period_start_at != null ? String(row.period_start_at) : undefined,
    period_end_at: row.period_end_at != null ? String(row.period_end_at) : undefined,
    timezone: row.timezone != null ? String(row.timezone) : undefined,
  };
}

export function parseDayCloseSessions(payload: unknown): DayCloseSession[] {
  if (Array.isArray(payload)) {
    return payload
      .map(parseDayCloseSession)
      .filter((item): item is DayCloseSession => item !== null);
  }
  const root = asRecord(payload);
  if (!root) return [];
  const data = root.data;
  if (Array.isArray(data)) {
    return data
      .map(parseDayCloseSession)
      .filter((item): item is DayCloseSession => item !== null);
  }
  return [];
}

export function parseDayCloseList(payload: unknown): DayCloseListItem[] {
  if (Array.isArray(payload)) {
    return payload
      .map(parseDayCloseListItem)
      .filter((item): item is DayCloseListItem => item !== null);
  }
  const root = asRecord(payload);
  if (!root) return [];
  const data = root.data;
  if (Array.isArray(data)) {
    return data
      .map(parseDayCloseListItem)
      .filter((item): item is DayCloseListItem => item !== null);
  }
  return [];
}

export function parseDayCloseCurrent(payload: unknown): DayCloseCurrent | null {
  const row = asRecord(payload);
  if (!row) return null;
  return {
    id: typeof row.id === "number" ? row.id : undefined,
    business_date: row.business_date != null ? String(row.business_date) : undefined,
    business_line: row.business_line != null ? String(row.business_line) : undefined,
    status: row.status != null ? String(row.status) : undefined,
    action_label: row.action_label != null ? String(row.action_label) : undefined,
    period_start_at: row.period_start_at != null ? String(row.period_start_at) : undefined,
    period_end_at: row.period_end_at != null ? String(row.period_end_at) : undefined,
    timezone: row.timezone != null ? String(row.timezone) : undefined,
    snapshot_preview: parseDayCloseSnapshotData(row.snapshot_preview ?? row.snapshot_data),
  };
}

export function parseDayCloseValidateResult(payload: unknown): DayCloseValidateResult | null {
  const row = asRecord(payload);
  if (!row) return null;
  return {
    can_close: Boolean(row.can_close),
    active_orders_count:
      typeof row.active_orders_count === "number" ? row.active_orders_count : undefined,
    pending_refunds_count:
      typeof row.pending_refunds_count === "number" ? row.pending_refunds_count : undefined,
    blockers: Array.isArray(row.blockers) ? row.blockers.map(String) : undefined,
    warnings: Array.isArray(row.warnings) ? row.warnings.map(String) : undefined,
  };
}

export function unwrapApiData<T>(payload: unknown, parser: (value: unknown) => T | null): T | null {
  const root = asRecord(payload);
  if (!root) return parser(payload);
  if (root.status === "success" && "data" in root) {
    return parser(root.data);
  }
  return parser(root.data ?? payload);
}

/** True when snapshot has the minimum fields needed to render financial sections. */
export function hasSnapshotFinancialData(snapshot: DayCloseSnapshotData | null | undefined): boolean {
  return Boolean(snapshot && (snapshot.payment_distribution || snapshot.net_sales != null));
}
