import apiClient from "@/lib/api-client";
import { PayrollApis } from "@/lib/api/endpoints";

export type PayrollReadinessBlocker = {
  code: string;
  message: string;
  staff_id?: number | null;
  action?: string | null;
  entry_ids?: number[];
  record_type?: string | null;
  record_ids?: number[];
};

export type PayrollOutstandingItem = {
  payroll_item_id: number;
  payroll_run_id: number;
  date_from: string;
  date_to: string;
  run_status: string;
  net_pay: number;
  paid_amount: number;
  outstanding_amount: number;
  due_date: string;
};

export type PayrollPeriodSuggestion = {
  staff_id: number;
  date_from: string;
  date_to: string;
  due_date: string;
  frequency: "monthly" | "weekly";
  ready: boolean;
  net_pay: number;
  blockers: PayrollReadinessBlocker[];
  is_current_accrual: boolean;
};

export type PayrollStaffBalance = {
  staff_id: number;
  user_id: number;
  staff_name: string;
  salary_type: string;
  total_due: number;
  total_paid: number;
  total_outstanding: number;
  current_accrual: number;
  paid_through?: string | null;
  overdue_period_count: number;
  outstanding_items: PayrollOutstandingItem[];
  suggested_periods: PayrollPeriodSuggestion[];
  current_period?: PayrollPeriodSuggestion | null;
};

export type PayrollDueSummary = {
  as_of: string;
  total_due: number;
  total_paid: number;
  total_outstanding: number;
  total_current_accrual: number;
  staff: PayrollStaffBalance[];
};

export type PayrollStaffSetup = {
  staff_id: number;
  user_id: number;
  staff_name: string;
  salary_type: "monthly" | "weekly" | "daily" | "hourly";
  compensation_ready: boolean;
  attendance_schedule_ready: boolean;
  ready: boolean;
  paid_through?: string | null;
  blockers: PayrollReadinessBlocker[];
};

export type PayrollSetupReadiness = {
  as_of: string;
  payroll_schedule_configured: boolean;
  staff_total: number;
  staff_ready: number;
  blocking_staff_count: number;
  all_ready: boolean;
  tracking_presets: {
    after_last_paid_period: string;
    current_month_start: string;
  };
  staff: PayrollStaffSetup[];
};

export type PayrollBulkPrepareResult = {
  created_runs: Array<{ id: number; date_from: string; date_to: string }>;
  created_run_count: number;
  prepared_staff_count: number;
  prepared_period_count: number;
  skipped_periods: Array<{
    date_from: string;
    date_to: string;
    staff_ids: number[];
    blockers: PayrollReadinessBlocker[];
  }>;
};

export type PayrollSchedule = {
  id: number;
  restaurant_id: number;
  staff_id?: number | null;
  frequency: "monthly" | "weekly";
  period_start_day: number;
  payment_delay_days: number;
  effective_from?: string | null;
  is_active: boolean;
};

export type PayrollPayment = {
  id: number;
  restaurant_id: number;
  staff_id: number;
  amount: number;
  payment_method: string;
  payment_bank_id?: number | null;
  payment_bank_name?: string | null;
  payment_instrument_id?: number | null;
  payment_instrument_name?: string | null;
  cash_source?: string | null;
  cash_source_name?: string | null;
  drawer_session_id?: number | null;
  drawer_session_name?: string | null;
  drawer_name?: string | null;
  payment_reference?: string | null;
  paid_at: string;
  notes?: string | null;
  status: "posted" | "reversed";
  created_by?: number | null;
  created_by_name?: string | null;
  reversed_at?: string | null;
  reversed_by?: number | null;
  reversed_by_name?: string | null;
  reversal_reason?: string | null;
  reversal_drawer_session_id?: number | null;
  reversal_drawer_session_name?: string | null;
  reversal_drawer_name?: string | null;
  created_at?: string | null;
  balance_after_payment?: number | null;
  source_balance_before?: number | null;
  source_balance_after?: number | null;
  finance_event_id?: number | null;
  reversal_finance_event_id?: number | null;
  metadata_reconstructed?: boolean;
  history_quality?: "exact" | "reconstructed" | "partial" | string;
  allocations: Array<{
    id: number;
    payroll_item_id: number;
    payroll_run_id?: number | null;
    date_from?: string | null;
    date_to?: string | null;
    amount: number;
    created_at?: string | null;
  }>;
};

export type PayrollTaxLiabilityRun = {
  payroll_run_id: number;
  date_from: string;
  date_to: string;
  status: string;
  accrued_tax: number;
  remitted_tax: number;
  outstanding_tax: number;
};

export type PayrollTaxLiability = {
  as_of: string;
  accrued_tax: number;
  remitted_tax: number;
  outstanding_tax: number;
  run_count: number;
  remittance_count: number;
  runs: PayrollTaxLiabilityRun[];
};

export type PayrollTaxRemittance = {
  id: number;
  restaurant_id: number;
  amount: number;
  remittance_date: string;
  remitted_at: string;
  payment_method: string;
  payment_reference?: string | null;
  payment_bank_id?: number | null;
  payment_bank_name?: string | null;
  payment_instrument_id?: number | null;
  payment_instrument_name?: string | null;
  cash_source?: string | null;
  cash_source_name?: string | null;
  drawer_session_id?: number | null;
  drawer_session_name?: string | null;
  drawer_name?: string | null;
  source_balance_before?: number | null;
  source_balance_after?: number | null;
  finance_event_id?: number | null;
  notes?: string | null;
  status: "posted" | "reversed";
  created_by?: number | null;
  created_by_name?: string | null;
  reversed_at?: string | null;
  reversed_by?: number | null;
  reversed_by_name?: string | null;
  reversal_reason?: string | null;
  reversal_drawer_session_id?: number | null;
  reversal_drawer_session_name?: string | null;
  reversal_drawer_name?: string | null;
  reversal_finance_event_id?: number | null;
  created_at?: string | null;
  allocations: Array<{
    id: number;
    payroll_run_id: number;
    date_from?: string | null;
    date_to?: string | null;
    tax_accrued: number;
    amount: number;
    created_at?: string | null;
  }>;
};

function unwrap<T>(response: { data: { data?: T } | T }): T {
  const body = response.data as { data?: T };
  return body && typeof body === "object" && "data" in body
    ? (body.data as T)
    : (response.data as T);
}

export const payrollPayablesApi = {
  async dueSummary(asOf?: string) {
    return unwrap<PayrollDueSummary>(
      await apiClient.get(PayrollApis.dueSummary(asOf)),
    );
  },

  async staffBalance(staffId: number, asOf?: string) {
    return unwrap<PayrollStaffBalance>(
      await apiClient.get(PayrollApis.staffBalance(staffId, asOf)),
    );
  },

  async setupReadiness(asOf?: string) {
    return unwrap<PayrollSetupReadiness>(
      await apiClient.get(PayrollApis.setupReadiness(asOf)),
    );
  },

  async bulkPrepare(payload: { as_of?: string; tax_percentage?: number } = {}) {
    return unwrap<PayrollBulkPrepareResult>(
      await apiClient.post(PayrollApis.bulkPrepare, payload),
    );
  },

  async schedules() {
    return unwrap<PayrollSchedule[]>(
      await apiClient.get(PayrollApis.schedules),
    );
  },

  async saveSchedule(payload: {
    staff_id?: number;
    frequency: "monthly" | "weekly";
    period_start_day: number;
    payment_delay_days: number;
    effective_from?: string;
    is_active: boolean;
  }) {
    return unwrap<PayrollSchedule>(
      await apiClient.put(PayrollApis.schedules, payload),
    );
  },

  async payments(staffId?: number) {
    return unwrap<PayrollPayment[]>(
      await apiClient.get(PayrollApis.payments(staffId)),
    );
  },

  async recordPayment(payload: {
    staff_id: number;
    amount: number;
    payment_method: "cash" | "bank_transfer";
    payment_bank_id?: number;
    payment_instrument_id?: number;
    cash_source?: string;
    drawer_session_id?: number;
    payment_reference?: string;
    paid_at?: string;
    notes?: string;
    allocations?: Array<{ payroll_item_id: number; amount: number }>;
  }) {
    return unwrap<PayrollPayment>(
      await apiClient.post(PayrollApis.recordPayment, payload),
    );
  },

  async reversePayment(
    paymentId: number,
    reason: string,
    drawerSessionId?: number,
  ) {
    return unwrap<PayrollPayment>(
      await apiClient.post(PayrollApis.reversePayment(paymentId), {
        reason,
        ...(drawerSessionId ? { drawer_session_id: drawerSessionId } : {}),
      }),
    );
  },

  async taxLiability(asOf?: string) {
    return unwrap<PayrollTaxLiability>(
      await apiClient.get(PayrollApis.taxLiability(asOf)),
    );
  },

  async taxRemittances(limit = 100) {
    return unwrap<PayrollTaxRemittance[]>(
      await apiClient.get(PayrollApis.taxRemittances(limit)),
    );
  },

  async recordTaxRemittance(payload: {
    amount: number;
    payment_method: "cash" | "bank_transfer";
    payment_reference?: string;
    payment_bank_id?: number;
    payment_instrument_id?: number;
    cash_source?: string;
    drawer_session_id?: number;
    remitted_at?: string;
    notes?: string;
    allocations?: Array<{ payroll_run_id: number; amount: number }>;
  }) {
    return unwrap<PayrollTaxRemittance>(
      await apiClient.post(PayrollApis.recordTaxRemittance, payload),
    );
  },

  async reverseTaxRemittance(
    remittanceId: number,
    reason: string,
    drawerSessionId?: number,
  ) {
    return unwrap<PayrollTaxRemittance>(
      await apiClient.post(PayrollApis.reverseTaxRemittance(remittanceId), {
        reason,
        ...(drawerSessionId ? { drawer_session_id: drawerSessionId } : {}),
      }),
    );
  },
};
