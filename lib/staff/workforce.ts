import apiClient from "@/lib/api-client";
import { PayrollApis, StaffProfileApis } from "@/lib/api/endpoints";

export type StaffProfile = {
  id: number;
  user_id: number;
  account_number: string;
  phone?: string | null;
  address?: string | null;
  age?: number | null;
  salary_type: "monthly" | "weekly" | "daily" | "hourly" | string;
  salary_amount: number;
  weekly_hours?: number | null;
  daily_hours?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type SalaryHistoryRecord = {
  id: number;
  staff_id: number;
  effective_from: string;
  effective_to?: string | null;
  salary_type: string;
  salary_amount: number;
  weekly_hours?: number | null;
  daily_hours?: number | null;
  reason?: string | null;
  created_at?: string;
};

export type PayrollRunSummary = {
  id: number;
  restaurant_id: number;
  date_from: string;
  date_to: string;
  period_days: number;
  status: string;
  use_approved_attendance: boolean;
  payment_reference?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  created_at?: string;
};

export type PayrollHistoryItem = {
  id: number;
  payroll_run_id: number;
  staff_id: number;
  salary_type: string;
  base_salary: number;
  period_days: number;
  daily_rate: number;
  earned_amount: number;
  regular_minutes: number;
  overtime_minutes: number;
  break_minutes: number;
  scheduled_days: number;
  payable_days: number;
  absent_days: number;
  regular_pay: number;
  overtime_pay: number;
  absence_deduction: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  paid_holiday_days: number;
  holiday_premium_pay: number;
  bonus: number;
  deduction: number;
  tax_amount: number;
  net_pay: number;
  salary_history_id?: number | null;
  salary_effective_from?: string | null;
  policy_evidence?: Array<Record<string, unknown>>;
};

export type PayrollHistoryRecord = {
  run: PayrollRunSummary;
  item: PayrollHistoryItem;
};

function unwrap<T>(response: { data: { data?: T } | T }): T {
  const body = response.data as { data?: T };
  return body && typeof body === "object" && "data" in body
    ? (body.data as T)
    : (response.data as T);
}

export const staffWorkforceApi = {
  async profileByUserId(userId: number) {
    const profiles = unwrap<StaffProfile[]>(
      await apiClient.get(StaffProfileApis.list({ limit: 500 })),
    );
    return profiles.find((profile) => Number(profile.user_id) === Number(userId)) ?? null;
  },

  async salaryHistory(staffId: number) {
    return unwrap<SalaryHistoryRecord[]>(
      await apiClient.get(StaffProfileApis.salaryHistory(staffId)),
    );
  },

  async payrollHistory(staffId: number) {
    return unwrap<PayrollHistoryRecord[]>(
      await apiClient.get(PayrollApis.staffHistory(staffId)),
    );
  },
};
