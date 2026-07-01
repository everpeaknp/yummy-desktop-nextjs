export type AccountingReportParams = {
  restaurantId: number;
  dateFrom?: string;
  dateTo?: string;
  businessLine?: string;
  timezone?: string;
  station?: string;
};

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "contra_revenue"
  | "expense";

export type NormalBalance = "debit" | "credit";

export type AccountNodeType = "group" | "ledger" | "subledger";

export type ProfitLossSection = "gross" | "net";

export type ChartAccount = {
  id: number;
  restaurant_id: number;
  code: string;
  name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  parent_id?: number | null;
  node_type: AccountNodeType;
  pnl_section?: ProfitLossSection | null;
  reconciliation_enabled: boolean;
  ledger_class?: string | null;
  ledger_type?: string | null;
  subledger_type?: string | null;
  reference_entity_id?: number | null;
  is_suspense: boolean;
  is_active: boolean;
};

export type ChartAccountPayload = {
  restaurant_id: number;
  code: string;
  name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  parent_id?: number | null;
  node_type: AccountNodeType;
  pnl_section?: ProfitLossSection | null;
  reconciliation_enabled?: boolean;
  ledger_class?: string | null;
  ledger_type?: string | null;
  subledger_type?: string | null;
  reference_entity_id?: number | null;
  is_suspense?: boolean;
  is_active?: boolean;
};

export type LedgerMapping = {
  id: number;
  restaurant_id: number;
  event_type: string;
  payment_method?: string | null;
  business_line: string;
  debit_account_id: number;
  credit_account_id: number;
  label?: string | null;
  description?: string | null;
  is_active?: boolean;
  updated_by_id?: number | null;
  updated_at?: string | null;
  debit_account?: ChartAccount | null;
  credit_account?: ChartAccount | null;
};

export type LedgerMappingPayload = {
  restaurant_id: number;
  event_type: string;
  payment_method?: string | null;
  business_line: string;
  debit_account_id: number;
  credit_account_id: number;
  label?: string | null;
  description?: string | null;
  is_active?: boolean;
  reason?: string | null;
};

export type MappingExceptionResolvePayload = {
  restaurant_id: number;
  event_type: string;
  payment_method?: string | null;
  business_line: string;
  debit_account_id: number;
  credit_account_id: number;
  label?: string | null;
  description?: string | null;
  reason?: string | null;
};

export type MappingExceptionRepostRequest = {
  restaurant_id: number;
  event_type: string;
  payment_method?: string | null;
  business_line: string;
  date_from?: string | null;
  date_to?: string | null;
  reversal_date?: string | null;
  reason: string;
};

export type MappingExceptionRepostResult = {
  restaurant_id: number;
  event_type: string;
  payment_method?: string | null;
  business_line: string;
  reversed_count: number;
  reposted_count: number;
  skipped_count: number;
  suspense_amount_before: number;
  suspense_amount_after: number;
  reversed_journal_entry_ids: number[];
  reposted_journal_entry_ids: number[];
};

export type AccountingSeedDefaultsResult = {
  accounts_created: number;
  mappings_created: number;
};

export type AccountingRestaurantSeedResult = {
  restaurant_id: number;
  accounts_created: number;
  mappings_created: number;
};

export type AccountingSeedAllDefaultsResult = {
  restaurants_seeded: number;
  accounts_created: number;
  mappings_created: number;
  restaurants: AccountingRestaurantSeedResult[];
};

export type AccountingPostResult = {
  posted_count: number;
  skipped_count: number;
};

export type AccountingDayClosePostingStatus = {
  day_close_id: number;
  restaurant_id: number;
  business_date: string;
  business_line: string;
  status: "posted" | "blocked" | "soft_closed" | "needs_review" | string;
  can_confirm: boolean;
  cash_expected: number;
  cash_actual: number;
  cash_variance: number;
  finance_events_posted: number;
  finance_events_skipped: number;
  journal_count: number;
  unposted_finance_events: number;
  trial_balance_difference: number;
  missing_mapping_count: number;
  suspense_amount: number;
  cash_variance_event_id?: number | null;
  cash_variance_journal_entry_id?: number | null;
  blockers: string[];
};

export type DayCloseAccountingReview = {
  id: number;
  day_close_id: number;
  status: "review_required" | "ready" | "reviewed" | "invalidated" | string;
  source_snapshot_hash: string;
  unposted_event_count: number;
  journal_count: number;
  trial_balance_difference: number;
  suspense_amount: number;
  mapping_exception_count: number;
  blockers: string[];
  cash_variance_event_id?: number | null;
  cash_variance_journal_id?: number | null;
  reviewed_by_id?: number | null;
  reviewed_at?: string | null;
  invalidated_by_id?: number | null;
  invalidated_at?: string | null;
  invalidation_reason?: string | null;
};

export type AccountingDayCloseEvidence = {
  day_close: AccountingDayClose;
  snapshot_data?: Record<string, unknown> | null;
  drawer_sessions: Array<Record<string, unknown>>;
  audit_trail: Array<Record<string, unknown>>;
};

export type AccountingDayClose = {
  id: number;
  restaurant_id: number;
  business_date: string;
  business_line: string;
  status: string;
  period_start_at?: string | null;
  period_end_at?: string | null;
  confirmed_at?: string | null;
  expected_cash: number;
  actual_cash: number;
  cash_discrepancy: number;
  accounting_status: AccountingDayClosePostingStatus;
  accounting_review?: DayCloseAccountingReview | null;
  snapshot_data?: Record<string, unknown> | null;
};

export type AccountingSettings = {
  id: number;
  restaurant_id: number;
  base_currency: string;
  fiscal_year_start_month: number;
  fiscal_year_start_day: number;
  vat_registration_number?: string | null;
  ird_sync_enabled: boolean;
  accounting_enabled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AccountingSetupRun = {
  id: number;
  restaurant_id: number;
  status: "completed" | "failed" | "pending" | string;
  accounts_created: number;
  mappings_created: number;
  warnings_json?: string[] | null;
  created_at?: string | null;
  completed_at?: string | null;
};

export type AccountingSetupStatus = {
  restaurant_id: number;
  ready: boolean;
  account_count: number;
  mapping_count: number;
  missing_account_codes: string[];
  missing_mapping_count: number;
  blocking_core_mapping_keys: string[];
  non_blocking_mapping_keys: string[];
  accounts_created: number;
  mappings_created: number;
  warnings: string[];
  settings?: AccountingSettings | null;
  latest_run?: AccountingSetupRun | null;
};

export type DaybookCashTransaction = {
  source_type: string;
  source_id?: number | null;
  label: string;
  occurred_at?: string | null;
  amount: number;
  signed_amount: number;
  drawer_session_id?: number | null;
  cashier_id?: number | null;
  journal_entry_id?: number | null;
  source_account?: string | null;
  destination_account?: string | null;
  reference?: string | null;
  status?: string | null;
};

export type AccountingDaybook = {
  restaurant_id: number;
  business_date: string;
  business_line: string;
  cash_control: {
    opening_balance: number;
    closing_balance: number;
    cash_sales: number;
    cash_refunds: number;
    drawer_expenses: number;
    transfers_out: number;
    transfers_in: number;
    variance: number;
    rows: DaybookCashTransaction[];
  };
  payment_instruments: Array<{
    payment_method: string;
    instrument?: string | null;
    expected_amount: number;
    settled_amount: number;
    clearing_status: string;
    settlement_batch_id?: number | null;
  }>;
  transfers: DaybookCashTransaction[];
  ledger_impact: {
    finance_event_count: number;
    journal_count: number;
    total_debit: number;
    total_credit: number;
  };
  exceptions: Array<{
    kind: string;
    label: string;
    amount: number;
    count: number;
    blocking: boolean;
  }>;
};

export type CashTransferInput = {
  restaurant_id: number;
  business_line?: string;
  transfer_mode: "pending_bank_deposit" | "confirm_bank_deposit" | "immediate_bank_deposit";
  transfer_date: string;
  amount: number;
  source?: string | null;
  destination?: string | null;
  reference?: string | null;
  note?: string | null;
};

export type CashTransferResult = {
  finance_event_id: number;
  event_type: string;
  event_key: string;
  journal_entry_id?: number | null;
  transfer_mode: string;
  amount: number;
  source?: string | null;
  destination?: string | null;
  reference?: string | null;
};

export type OpeningBalanceLine = {
  id: number;
  batch_id: number;
  account_id: number;
  debit: number;
  credit: number;
  party_type?: string | null;
  party_id?: number | null;
  memo?: string | null;
  account?: ChartAccount | null;
};

export type OpeningBalanceBatch = {
  id: number;
  restaurant_id: number;
  as_of_date: string;
  status: "draft" | "posted" | "reversed" | string;
  debit_total: number;
  credit_total: number;
  journal_entry_id?: number | null;
  created_by_id?: number | null;
  posted_by_id?: number | null;
  posted_at?: string | null;
  reversed_by_entry_id?: number | null;
  created_at?: string | null;
  lines: OpeningBalanceLine[];
};

export type OpeningBalanceLineInput = {
  account_id: number;
  debit?: number;
  credit?: number;
  party_type?: string | null;
  party_id?: number | null;
  memo?: string | null;
};

export type OpeningBalanceBatchInput = {
  restaurant_id: number;
  as_of_date: string;
  lines: OpeningBalanceLineInput[];
};

export type JournalVoucherStatus = "draft" | "submitted" | "approved" | "rejected" | "posted" | "reversed" | string;

export type JournalVoucherType =
  | "journal"
  | "receipt"
  | "payment"
  | "contra"
  | "opening_balance"
  | "adjustment"
  | "reversal"
  | string;

export type JournalVoucherLine = {
  id: number;
  journal_entry_id: number;
  line_no?: number | null;
  account_id: number;
  debit: number;
  credit: number;
  memo?: string | null;
  party_type?: string | null;
  party_id?: number | null;
  business_line?: string | null;
  station?: string | null;
  account?: ChartAccount | null;
};

export type JournalVoucher = {
  id: number;
  restaurant_id: number;
  entry_number?: string | null;
  source_type: string;
  source_key: string;
  entry_date: string;
  business_date: string;
  memo?: string | null;
  status: string;
  voucher_type?: JournalVoucherType | null;
  approval_status?: JournalVoucherStatus | null;
  period_id?: number | null;
  business_line?: string | null;
  station?: string | null;
  created_by_id?: number | null;
  submitted_by_id?: number | null;
  approved_by_id?: number | null;
  posted_by_id?: number | null;
  reversal_of_entry_id?: number | null;
  reversed_by_entry_id?: number | null;
  external_reference?: string | null;
  metadata_json?: Record<string, unknown> | null;
  created_at?: string | null;
  lines: JournalVoucherLine[];
};

export type JournalVoucherLineInput = {
  account_id: number;
  debit?: number;
  credit?: number;
  memo?: string | null;
  party_type?: string | null;
  party_id?: number | null;
  business_line?: string | null;
  station?: string | null;
};

export type JournalVoucherInput = {
  restaurant_id: number;
  entry_date: string;
  business_date?: string | null;
  voucher_type?: JournalVoucherType;
  memo?: string | null;
  business_line?: string | null;
  station?: string | null;
  external_reference?: string | null;
  metadata_json?: Record<string, unknown> | null;
  lines: JournalVoucherLineInput[];
};

export type JournalVoucherUpdateInput = Partial<Omit<JournalVoucherInput, "restaurant_id">>;

export type JournalEntryReverseInput = {
  reversal_date?: string | null;
  memo?: string | null;
  allow_system_override?: boolean;
};

export type AccountingPeriodStatus = "open" | "soft_closed" | "locked" | "reopened" | string;

export type AccountingPeriod = {
  id: number;
  restaurant_id: number;
  fiscal_year_id: number;
  period_type: "month" | "quarter" | "year" | string;
  period_label: string;
  start_date: string;
  end_date: string;
  status: AccountingPeriodStatus;
  closed_by_id?: number | null;
  closed_at?: string | null;
  locked_by_id?: number | null;
  locked_at?: string | null;
  reopened_by_id?: number | null;
  reopened_at?: string | null;
  close_snapshot_json?: Record<string, unknown> | null;
  source_hash?: string | null;
  created_at?: string | null;
};

export type AccountingPeriodGenerateInput = {
  restaurant_id: number;
  year_label: string;
  start_date: string;
  end_date: string;
};

export type AccountingPeriodPreflightBlocker = {
  key: string;
  label: string;
  status: AccountingHealthStatus;
  value?: string | number | boolean | null;
  message: string;
};

export type AccountingPeriodPreflight = {
  period_id: number;
  can_lock: boolean;
  unposted_finance_events: number;
  trial_balance_difference: number;
  missing_mapping_count: number;
  suspense_amount: number;
  required_day_closes: number;
  confirmed_day_closes: number;
  reviewed_day_closes: number;
  unreviewed_day_closes: number;
  missing_operational_days: string[];
  invalidated_review_days: string[];
  blockers: AccountingPeriodPreflightBlocker[];
};

export type AccountingHealthStatus = "ok" | "warning" | "blocked" | "unknown" | string;

export type AccountingHealthItem = {
  key: string;
  label: string;
  status: AccountingHealthStatus;
  value?: string | number | boolean | null;
  message: string;
};

export type AccountingHealthResponse = {
  status: AccountingHealthStatus;
  accounts_seeded: AccountingHealthItem;
  mappings_seeded: AccountingHealthItem;
  opening_balances_posted: AccountingHealthItem;
  latest_backfill_status: AccountingHealthItem;
  unposted_finance_events: AccountingHealthItem;
  trial_balance_difference: AccountingHealthItem;
  missing_mapping_count: AccountingHealthItem;
  suspense_amount: AccountingHealthItem;
  open_period: AccountingHealthItem;
  locked_period_violations: AccountingHealthItem;
  vat_sales_difference: AccountingHealthItem;
  payment_settlement_variance: AccountingHealthItem;
};

export type AccountingBackfillRequest = {
  restaurant_id: number;
  date_from?: string | null;
  date_to?: string | null;
  business_line?: string | null;
};

export type AccountingBackfillRun = {
  id: number;
  restaurant_id: number;
  mode: "dry_run" | "commit" | string;
  status: "pending" | "completed" | "failed" | string;
  date_from?: string | null;
  date_to?: string | null;
  business_line?: string | null;
  dry_run_id?: number | null;
  source_counts_json?: Record<string, number> | null;
  exception_samples_json?: unknown[] | null;
  expected_journal_count: number;
  expected_debit_total: number;
  expected_credit_total: number;
  missing_mapping_count: number;
  suspense_amount: number;
  finance_events_created: number;
  finance_events_skipped: number;
  journals_posted: number;
  journals_skipped: number;
  created_at?: string | null;
  completed_at?: string | null;
};

export type FinanceEventBackfillStatus = {
  restaurant_id: number;
  business_line?: string | null;
  total_expected: number;
  existing_count: number;
  missing_count: number;
  source_counts_json?: Record<string, number> | null;
  latest_backfill_run_id?: number | null;
  latest_backfill_created_at?: string | null;
};

export type PaymentSettlementStatus =
  | "draft"
  | "bank_confirmed"
  | "matched"
  | "variance_approved"
  | "posted"
  | "reversed"
  | string;

export type PaymentBank = {
  id: number;
  restaurant_id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
};

export type PaymentBankInput = {
  restaurant_id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
};

export type PaymentInstrument = {
  id: number;
  restaurant_id: number;
  business_line: string;
  payment_method: string;
  instrument_type: string;
  name: string;
  provider?: string | null;
  bank_id?: number | null;
  clearing_account_id?: number | null;
  bank_account_id?: number | null;
  fee_account_id?: number | null;
  settlement_cycle_days: number;
  is_active: boolean;
  metadata_json?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PaymentInstrumentInput = {
  restaurant_id: number;
  business_line?: string;
  payment_method: string;
  instrument_type: string;
  name: string;
  provider?: string | null;
  bank_id?: number | null;
  clearing_account_id?: number | null;
  bank_account_id?: number | null;
  fee_account_id?: number | null;
  settlement_cycle_days?: number;
  is_active?: boolean;
  metadata_json?: Record<string, unknown> | null;
};

export type PaymentSettlementLine = {
  id: number;
  batch_id: number;
  payment_id?: number | null;
  finance_event_id?: number | null;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  created_at?: string | null;
};

export type PaymentSettlementBatch = {
  id: number;
  restaurant_id: number;
  business_line: string;
  payment_method: string;
  instrument?: string | null;
  date_from: string;
  date_to: string;
  settlement_date: string;
  expected_amount: number;
  actual_amount: number;
  fee_amount: number;
  variance_amount: number;
  status: PaymentSettlementStatus;
  journal_entry_id?: number | null;
  reversed_by_entry_id?: number | null;
  bank_account_id?: number | null;
  bank_reference?: string | null;
  created_by_id?: number | null;
  confirmed_by_id?: number | null;
  approved_by_id?: number | null;
  posted_by_id?: number | null;
  variance_reason?: string | null;
  created_at?: string | null;
  confirmed_at?: string | null;
  approved_at?: string | null;
  posted_at?: string | null;
  lines: PaymentSettlementLine[];
};

export type PaymentSettlementPreviewLine = {
  finance_event_id: number;
  event_type: string;
  event_at: string;
  financial_date: string;
  payment_method: string;
  instrument?: string | null;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
};

export type PaymentSettlementPreviewResponse = {
  restaurant_id: number;
  payment_method: string;
  instrument?: string | null;
  date_from: string;
  date_to: string;
  settlement_date: string;
  pos_collections: number;
  refunds: number;
  expected_amount: number;
  actual_amount: number;
  fee_amount: number;
  variance_amount: number;
  lines: PaymentSettlementPreviewLine[];
};

export type PaymentSettlementPreviewInput = {
  restaurant_id: number;
  payment_method: string;
  instrument?: string | null;
  date_from: string;
  date_to: string;
  settlement_date: string;
  actual_amount: number;
  fee_amount: number;
  business_line?: string | null;
};

export type PaymentSettlementCreateInput = Omit<PaymentSettlementPreviewInput, "actual_amount" | "fee_amount"> & {
  actual_amount?: number;
  fee_amount?: number;
};

export type PaymentSettlementBankConfirmInput = {
  settlement_date: string;
  actual_amount: number;
  fee_amount?: number;
  bank_account_id?: number | null;
  bank_reference: string;
};

export type PaymentSettlementVarianceApprovalInput = {
  reason: string;
};

export type TrialBalanceRow = {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: AccountType | string;
  debit: number;
  credit: number;
  balance: number;
};

export type TrialBalanceResponse = {
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
};

export type GeneralLedgerLine = {
  journal_entry_id: number;
  journal_line_id: number;
  account_id: number;
  entry_date: string;
  business_date: string;
  source_type: string;
  source_key: string;
  finance_event_id?: number | null;
  station?: string | null;
  account_code: string;
  account_name: string;
  account_type: AccountType | string;
  memo?: string | null;
  debit: number;
  credit: number;
};

export type GeneralLedgerResponse = {
  rows: GeneralLedgerLine[];
  total_debit: number;
  total_credit: number;
};

export type AccountingDrilldownLine = {
  journal_entry_id: number;
  journal_line_id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: AccountType | string;
  entry_date: string;
  business_date: string;
  source_type: string;
  source_key: string;
  finance_event_id?: number | null;
  finance_event_key?: string | null;
  finance_event_type?: string | null;
  source_id?: number | null;
  source_label: string;
  memo?: string | null;
  debit: number;
  credit: number;
};

export type AccountingDrilldownResponse = {
  trace_path: string[];
  lines: AccountingDrilldownLine[];
  total_debit: number;
  total_credit: number;
};

export type AccountingSourceTraceEvent = {
  id: number;
  event_key: string;
  event_type: string;
  source_type: string;
  source_id?: number | null;
  event_at: string;
  business_date: string;
  financial_date: string;
  amount: number;
  direction: string;
  payment_method?: string | null;
  order_id?: number | null;
  customer_id?: number | null;
  supplier_id?: number | null;
  metadata_json?: Record<string, unknown> | null;
};

export type AccountingSourceTraceJournal = {
  id: number;
  entry_number?: string | null;
  source_type: string;
  source_key: string;
  finance_event_id?: number | null;
  entry_date: string;
  business_date: string;
  memo?: string | null;
  status: string;
  lines: AccountingDrilldownLine[];
};

export type AccountingSourceTraceResponse = {
  source_type: string;
  source_id: number;
  trace_path: string[];
  finance_events: AccountingSourceTraceEvent[];
  journal_entries: AccountingSourceTraceJournal[];
};

export type FinancialStatementLine = {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: AccountType | string;
  parent_account_id?: number | null;
  node_type?: AccountNodeType | string;
  pnl_section?: ProfitLossSection | string | null;
  amount: number;
};

export type ProfitLossResponse = {
  revenue: FinancialStatementLine[];
  contra_revenue: FinancialStatementLine[];
  expenses: FinancialStatementLine[];
  total_revenue: number;
  total_contra_revenue: number;
  total_expenses: number;
  inventory_cogs: number;
  gross_profit: number;
  net_profit: number;
};

export type BalanceSheetResponse = {
  assets: FinancialStatementLine[];
  liabilities: FinancialStatementLine[];
  equity: FinancialStatementLine[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  current_earnings: number;
  total_liabilities_and_equity: number;
};

export type VatSummaryResponse = {
  rows: FinancialStatementLine[];
  taxable_sales: number;
  tax_collected: number;
  tax_reversed: number;
  net_tax_payable: number;
};

export type VatExportRequest = {
  restaurant_id: number;
  date_from: string;
  date_to: string;
  business_line?: string | null;
};

export type VatExportValidationError = {
  code: string;
  message: string;
  sales_book_total?: number;
  vat_summary_total?: number;
  difference?: number;
  source?: string;
};

export type VatExportRun = {
  id: number;
  restaurant_id: number;
  date_from: string;
  date_to: string;
  business_line?: string | null;
  status: "validated" | "generated" | "failed" | string;
  sales_book_total: number;
  vat_summary_total: number;
  difference: number;
  row_count: number;
  validation_errors_json: VatExportValidationError[];
  export_file_url?: string | null;
  created_by_id?: number | null;
  created_at?: string | null;
  can_generate: boolean;
};

export type CustomerLedgerRow = {
  finance_event_id: number;
  event_type: string;
  event_at: string;
  business_date: string;
  customer_id: number;
  customer_name?: string | null;
  order_id?: number | null;
  invoice_number?: string | null;
  payment_method?: string | null;
  debit: number;
  credit: number;
  balance: number;
  memo?: string | null;
};

export type CustomerLedgerResponse = {
  rows: CustomerLedgerRow[];
  total_debit: number;
  total_credit: number;
  closing_balance: number;
};

export type SupplierLedgerRow = {
  finance_event_id: number;
  event_type: string;
  event_at: string;
  business_date: string;
  supplier_id: number;
  supplier_name?: string | null;
  payment_method?: string | null;
  debit: number;
  credit: number;
  balance: number;
  memo?: string | null;
};

export type SupplierLedgerResponse = {
  rows: SupplierLedgerRow[];
  total_debit: number;
  total_credit: number;
  closing_balance: number;
};

export type AgingBucketSummary = {
  current: number;
  bucket_1_7: number;
  bucket_8_15: number;
  bucket_16_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  over_90: number;
  total_outstanding: number;
  oldest_unpaid_date?: string | null;
};

export type ARAgingRow = AgingBucketSummary & {
  customer_id: number;
  customer_name?: string | null;
};

export type ARAgingResponse = AgingBucketSummary & {
  as_of: string;
  rows: ARAgingRow[];
};

export type APAgingRow = AgingBucketSummary & {
  supplier_id: number;
  supplier_name?: string | null;
};

export type APAgingResponse = AgingBucketSummary & {
  as_of: string;
  rows: APAgingRow[];
};

export type StatementMovementRow = {
  finance_event_id: number;
  event_type: string;
  event_at: string;
  business_date: string;
  reference?: string | null;
  payment_method?: string | null;
  debit: number;
  credit: number;
  balance: number;
  memo?: string | null;
};

export type CustomerStatementResponse = {
  customer_id: number;
  customer_name?: string | null;
  date_from: string;
  date_to: string;
  opening_balance: number;
  new_invoices: number;
  receipts: number;
  refunds: number;
  adjustments: number;
  closing_balance: number;
  rows: StatementMovementRow[];
};

export type SupplierStatementResponse = {
  supplier_id: number;
  supplier_name?: string | null;
  date_from: string;
  date_to: string;
  opening_balance: number;
  new_payables: number;
  payments: number;
  returns: number;
  adjustments: number;
  closing_balance: number;
  rows: StatementMovementRow[];
};

export type CashFlowRow = {
  finance_event_id: number;
  event_type: string;
  event_at: string;
  business_date: string;
  category: string;
  payment_method?: string | null;
  amount: number;
  signed_amount: number;
  memo?: string | null;
};

export type CashFlowResponse = {
  rows: CashFlowRow[];
  operating_inflows: number;
  operating_outflows: number;
  refund_outflows: number;
  inventory_outflows: number;
  supplier_outflows: number;
  cash_variance: number;
  net_cash_flow: number;
};

export type MappingExceptionRow = {
  event_type: string;
  payment_method?: string | null;
  business_line: string;
  count: number;
  suspense_amount: number;
};

export type MappingExceptionReportResponse = {
  rows: MappingExceptionRow[];
  missing_mapping_count: number;
  suspense_amount: number;
};
