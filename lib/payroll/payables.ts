import apiClient from "@/lib/api-client";
import { PayrollApis } from "@/lib/api/endpoints";

export type PayrollReadinessBlocker = {
  code: string;
  message: string;
  staff_id?: number | null;
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
  payment_reference?: string | null;
  paid_at: string;
  notes?: string | null;
  status: "posted" | "reversed";
  reversal_reason?: string | null;
  allocations: Array<{
    id: number;
    payroll_item_id: number;
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
    payment_method: string;
    payment_reference?: string;
    paid_at?: string;
    notes?: string;
    allocations?: Array<{ payroll_item_id: number; amount: number }>;
  }) {
    return unwrap<PayrollPayment>(
      await apiClient.post(PayrollApis.recordPayment, payload),
    );
  },

  async reversePayment(paymentId: number, reason: string) {
    return unwrap<PayrollPayment>(
      await apiClient.post(PayrollApis.reversePayment(paymentId), { reason }),
    );
  },
};
