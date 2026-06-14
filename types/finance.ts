export type FinanceMeta = {
  restaurant_id: number;
  business_line: string;
  station?: string | null;
  timezone: string;
  window_start: string;
  window_end: string;
  date_from: string;
  date_to: string;
  contract_version: string;
};

export type FinanceOverviewMetrics = {
  gross_sales: number;
  sales_total: number;
  discount_total: number;
  net_sales: number;
  collections_total: number;
  credit_sales: number;
  refund_total: number;
  manual_income_total: number;
  manual_operating_expense: number;
  inventory_cash_outflow: number;
  inventory_asset_acquired: number;
  inventory_cogs: number;
  operating_profit: number;
  cash_expected: number;
  outstanding_receivables: number;
  refund_liabilities: number;
  supplier_payables: number;
  supplier_payments: number;
  current_period_sales_collected: number;
  prior_period_payments_applied: number;
  post_period_payments_applied: number;
  collections_for_other_period_sales: number;
  uncollected_sales_balance: number;
  sales_collection_gap: number;
  paid_open_orders_count: number;
  paid_open_orders_amount: number;
};

export type FinanceBreakdownRow = {
  method: string;
  amount: number;
  percentage: number;
  instrument?: string | null;
  instrument_type?: string | null;
};

export type FinanceOverviewResponse = {
  meta: FinanceMeta;
  metrics: FinanceOverviewMetrics;
  payment_method_breakdown: FinanceBreakdownRow[];
  payment_instrument_breakdown: FinanceBreakdownRow[];
};

export type FinanceTransactionRow = {
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
  instrument_type?: string | null;
  instrument_name?: string | null;
  customer_id?: number | null;
  supplier_id?: number | null;
  order_id?: number | null;
  metadata_json?: Record<string, unknown> | null;
};

export type FinanceTransactionsResponse = {
  meta: FinanceMeta;
  transactions: FinanceTransactionRow[];
  total: number;
  limit: number;
  offset: number;
};

export type FinanceExpensesResponse = {
  meta: FinanceMeta;
  metrics: FinanceOverviewMetrics;
  transactions: FinanceTransactionRow[];
};

export type FinanceReceivablesResponse = {
  meta: FinanceMeta;
  credit_sales: number;
  credit_repayments: number;
  outstanding_receivables: number;
  transactions: FinanceTransactionRow[];
};

export type FinanceReconciliationResponse = {
  meta: FinanceMeta;
  metrics: FinanceOverviewMetrics;
  cash_variance_total: number;
  transactions: FinanceTransactionRow[];
};

export type AccountingPostResult = {
  posted_count: number;
  skipped_count: number;
};

export type TrialBalanceRow = {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
  balance: number;
};

export type TrialBalanceResponse = {
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
};
