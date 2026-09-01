export type FinanceHeadType =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "contra_income"
  | "expense";

export type FinanceNormalSide = "debit" | "credit";

export type FinanceEntryStatus = "posted" | "reversed";

export interface FinanceReportingHeadRead {
  id: number;
  restaurant_id: number;
  code: string;
  name: string;
  head_type: FinanceHeadType;
  normal_side: FinanceNormalSide;
  parent_id: number | null;
  is_postable: boolean;
  is_active: boolean;
  system_role: string | null;
  business_line_scope: string | null;
  station_scope: string | null;
  description: string | null;
  depth: number;
  hierarchy_path: string;
  created_at: string | null;
  updated_at: string | null;
}

// The reporting-head tree endpoint returns a head's fields directly with a
// recursive `children` collection. It does not wrap each node in `{ head }`.
export interface FinanceReportingTreeNode extends FinanceReportingHeadRead {
  children: FinanceReportingTreeNode[];
}

export interface FinanceReportingHeadCreate {
  name: string;
  parent_id: number;
  code?: string | null;
  business_line_scope?: string | null;
  station_scope?: string | null;
  description?: string | null;
}

export interface FinanceReportingGroupCreate {
  name: string;
  parent_id: number;
  code?: string | null;
  business_line_scope?: string | null;
  station_scope?: string | null;
  description?: string | null;
}

export interface FinanceReportingHeadUpdate {
  name?: string | null;
  description?: string | null;
  business_line_scope?: string | null;
  station_scope?: string | null;
  is_active?: boolean | null;
}

export interface FinanceReportingBindingRead {
  id: number;
  restaurant_id: number;
  system_role: string;
  reporting_head_id: number;
  reporting_head_code?: string | null;
  reporting_head_name?: string | null;
  description?: string | null;
  is_system_locked: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OpeningBalanceLineInput {
  reporting_head_id: number;
  debit?: number | null;
  credit?: number | null;
  party_type?: string | null;
  party_id?: number | null;
  description?: string | null;
}

export interface OpeningBalanceCreate {
  as_of_date: string;
  lines: OpeningBalanceLineInput[];
  counterpart_head_id?: number | null;
  memo?: string | null;
}

export interface FinanceReportingLineRead {
  id: number;
  entry_id: number;
  reporting_head_id: number;
  reporting_head_code?: string | null;
  reporting_head_name?: string | null;
  debit?: number | null;
  credit?: number | null;
  description?: string | null;
  party_type?: string | null;
  party_id?: number | null;
  created_at?: string | null;
}

export interface FinanceReportingEntryRead {
  id: number;
  restaurant_id: number;
  source_type: string;
  source_id?: number | null;
  source_key: string;
  business_date: string;
  occurred_at: string;
  status: FinanceEntryStatus;
  actor_id?: number | null;
  original_entry_id?: number | null;
  reversal_entry_id?: number | null;
  lines: FinanceReportingLineRead[];
  created_at?: string | null;
}

export interface ManualJournalLineInput {
  reporting_head_id: number;
  debit?: number | null;
  credit?: number | null;
  description?: string | null;
  party_type?: string | null;
  party_id?: number | null;
}

export interface ManualJournalCreate {
  client_reference: string;
  business_date: string;
  occurred_at?: string | null;
  business_line?: string | null;
  station?: string | null;
  memo: string;
  lines: ManualJournalLineInput[];
}

export interface ManualJournalReverse {
  reason: string;
}

export interface ManualJournalListRead {
  entries: FinanceReportingEntryRead[];
  total: number;
  limit: number;
  offset: number;
}

export type FinanceReportingMoney = number | string;

export interface FinanceReportingReportPeriod {
  date_from: string | null;
  date_to: string | null;
  business_line: string | null;
  station: string | null;
}

export interface FinanceReportingClosureSummary {
  confirmed_day_count: number;
  unconfirmed_day_count: number;
  reopened_day_count: number;
}

export interface FinanceReportingHeadAmount {
  head_id: number;
  code: string;
  name: string;
  parent_id: number | null;
  depth: number;
  amount: FinanceReportingMoney;
}

export interface FinanceReportingInventoryReconciliation {
  opening_inventory: FinanceReportingMoney;
  stock_additions: FinanceReportingMoney;
  closing_inventory: FinanceReportingMoney;
  calculated_stock_used: FinanceReportingMoney;
  recognized_cogs: FinanceReportingMoney;
  other_inventory_reductions: FinanceReportingMoney;
}

export interface FinanceReportingProfitLossRead {
  period: FinanceReportingReportPeriod;
  closure: FinanceReportingClosureSummary;
  income: FinanceReportingHeadAmount[];
  contra_income: FinanceReportingHeadAmount[];
  expenses: FinanceReportingHeadAmount[];
  total_income: FinanceReportingMoney;
  total_contra_income: FinanceReportingMoney;
  total_expenses: FinanceReportingMoney;
  net_profit: FinanceReportingMoney;
  inventory_reconciliation: FinanceReportingInventoryReconciliation;
}

export interface FinanceReportingDepartment {
  station: string;
  total_income: FinanceReportingMoney;
  total_expenses: FinanceReportingMoney;
  net_profit: FinanceReportingMoney;
}

export interface FinanceReportingDepartmentBreakdownRead {
  period: FinanceReportingReportPeriod;
  departments: FinanceReportingDepartment[];
}

export interface FinanceReportingTrialBalanceRow {
  head_id: number;
  code: string;
  name: string;
  head_type: FinanceHeadType;
  normal_side: FinanceNormalSide;
  parent_id: number | null;
  depth: number;
  is_postable: boolean;
  opening_debit: FinanceReportingMoney;
  opening_credit: FinanceReportingMoney;
  period_debit: FinanceReportingMoney;
  period_credit: FinanceReportingMoney;
  closing_debit: FinanceReportingMoney;
  closing_credit: FinanceReportingMoney;
  balance: FinanceReportingMoney;
}

export interface FinanceReportingTrialBalanceRead {
  period: FinanceReportingReportPeriod;
  closure: FinanceReportingClosureSummary;
  rows: FinanceReportingTrialBalanceRow[];
  total_opening_debit: FinanceReportingMoney;
  total_opening_credit: FinanceReportingMoney;
  total_period_debit: FinanceReportingMoney;
  total_period_credit: FinanceReportingMoney;
  total_closing_debit: FinanceReportingMoney;
  total_closing_credit: FinanceReportingMoney;
  is_balanced: boolean;
}

export interface FinanceReportingLedgerLine {
  line_id: number;
  entry_id: number;
  business_date: string;
  occurred_at: string;
  source_type: string;
  source_id: number | null;
  source_key: string;
  entry_status: FinanceEntryStatus;
  description: string | null;
  party_type: string | null;
  party_id: number | null;
  party_name: string | null;
  order_reference: string | null;
  order_channel: string | null;
  order_customer_name: string | null;
  payment_method: string | null;
  debit: FinanceReportingMoney;
  credit: FinanceReportingMoney;
  running_balance: FinanceReportingMoney;
  finance_event_id: number | null;
}

export interface FinanceReportingAccountLedgerRead {
  head: FinanceReportingHeadRead;
  period: FinanceReportingReportPeriod;
  closure: FinanceReportingClosureSummary;
  opening_balance: FinanceReportingMoney;
  total_debit: FinanceReportingMoney;
  total_credit: FinanceReportingMoney;
  closing_balance: FinanceReportingMoney;
  total: number;
  limit: number;
  offset: number;
  lines: FinanceReportingLedgerLine[];
}

export type FinanceCustodyReconciliationStatus = string;

export interface FinanceCustodyReconciliationRow {
  account_type: string;
  account_id: number;
  account_name: string;
  account_subtype: string | null;
  reporting_head_id: number | null;
  reporting_head_name: string | null;
  custody_balance: FinanceReportingMoney;
  reporting_balance: FinanceReportingMoney;
  difference: FinanceReportingMoney;
  status: FinanceCustodyReconciliationStatus;
}

export interface FinanceCustodyReconciliationRead {
  as_of_date: string;
  snapshot_at: string;
  rows: FinanceCustodyReconciliationRow[];
  total_custody_balance: FinanceReportingMoney;
  total_reporting_balance: FinanceReportingMoney;
  total_difference: FinanceReportingMoney;
  balanced: boolean;
  unlinked_count: number;
}

export interface FinanceReportingBalanceSheetRead {
  as_of_date: string | null;
  closure: FinanceReportingClosureSummary;
  assets: FinanceReportingHeadAmount[];
  liabilities: FinanceReportingHeadAmount[];
  equity: FinanceReportingHeadAmount[];
  total_assets: FinanceReportingMoney;
  total_liabilities: FinanceReportingMoney;
  total_equity: FinanceReportingMoney;
  current_earnings: FinanceReportingMoney;
  total_liabilities_and_equity: FinanceReportingMoney;
  difference: FinanceReportingMoney;
  is_balanced: boolean;
}

export interface FinanceReportingPartyBalanceRow {
  party_type: string;
  party_id: number;
  party_name: string | null;
  reporting_head_id: number;
  reporting_head_name: string;
  balance_type: "receivable" | "payable";
  balance: FinanceReportingMoney;
}

export interface FinanceReportingPartyBalancesRead {
  as_of_date: string | null;
  rows: FinanceReportingPartyBalanceRow[];
  total_receivables: FinanceReportingMoney;
  total_payables: FinanceReportingMoney;
}

export interface FinanceReportingCashFlowRow {
  source_type: string;
  activity_type: "operating" | "investing" | "financing";
  inflow: FinanceReportingMoney;
  outflow: FinanceReportingMoney;
  net_cash_flow: FinanceReportingMoney;
}

export interface FinanceReportingCashFlowRead {
  period: FinanceReportingReportPeriod;
  closure: FinanceReportingClosureSummary;
  rows: FinanceReportingCashFlowRow[];
  operating_net: FinanceReportingMoney;
  investing_net: FinanceReportingMoney;
  financing_net: FinanceReportingMoney;
  net_cash_flow: FinanceReportingMoney;
}

export interface FinanceReportingHeadActivityRead {
  period: FinanceReportingReportPeriod;
  closure: FinanceReportingClosureSummary;
  rows: FinanceReportingTrialBalanceRow[];
}
