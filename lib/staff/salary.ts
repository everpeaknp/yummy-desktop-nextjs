import apiClient from "@/lib/api-client";
import { StaffSalaryApis } from "@/lib/api/endpoints";

export type StaffSalaryDirection =
  | "salary_paid"
  | "salary_deducted"
  | "overtime_paid";

export type StaffSalaryBreakdown = {
  /** Attendance mode only. */
  off_days?: number;
  absent_days?: number;
  worked_days?: number;
  worked_hours?: number;
};

export type StaffSalaryBalance = {
  staff_id: number;
  /** "flat" or "attendance". */
  mode: "flat" | "attendance";
  accrued: number;
  paid: number;
  deducted: number;
  balance: number;
  accrual_start_date?: string | null;
  daily_rate: number;
  /** The effective salary the rate is derived from, e.g. Rs 1000/month. */
  salary_amount: number;
  /** "monthly", "weekly", "daily", or "hourly". */
  salary_type?: string | null;
  /** Calendar days since accrual_start_date, inclusive. */
  days_elapsed: number;
  breakdown: StaffSalaryBreakdown;
};

export type StaffOvertimeSummary = {
  staff_id: number;
  outstanding_minutes: number;
  resolved_through?: string | null;
};

export type StaffSalaryTransaction = {
  id: number;
  staff_id: number;
  direction: StaffSalaryDirection | string;
  amount: number;
  payment_method?: string | null;
  reason?: string | null;
  reference?: string | null;
  balance_after?: number | null;
  status: "posted" | "reversed";
  created_at: string;
};

/** One row of a "Pay all" preview -- what would be paid, before committing. */
export type StaffPayAllPreviewItem = {
  staff_id: number;
  user_id?: number | null;
  user_name?: string | null;
  amount: number;
};

function unwrap<T>(response: { data: { data?: T } | T }): T {
  const body = response.data as { data?: T };
  return body && typeof body === "object" && "data" in body
    ? (body.data as T)
    : (response.data as T);
}

/** The backend serializes `Decimal` fields as JSON strings (to avoid float
 * precision loss), so money values arrive as either a number or a numeric
 * string even though these types declare `number` -- coerce here, once, so
 * every caller downstream can trust the type it was given. */
function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toNumOrNull(value: unknown): number | null {
  return value == null ? null : toNum(value);
}

function normalizeBalance(b: StaffSalaryBalance): StaffSalaryBalance {
  return {
    ...b,
    accrued: toNum(b.accrued),
    paid: toNum(b.paid),
    deducted: toNum(b.deducted),
    balance: toNum(b.balance),
    daily_rate: toNum(b.daily_rate),
    salary_amount: toNum(b.salary_amount),
    breakdown: {
      ...b.breakdown,
      worked_hours:
        b.breakdown?.worked_hours == null ? undefined : toNum(b.breakdown.worked_hours),
    },
  };
}

function normalizeTransaction(t: StaffSalaryTransaction): StaffSalaryTransaction {
  return { ...t, amount: toNum(t.amount), balance_after: toNumOrNull(t.balance_after) };
}

function normalizePreviewItem(item: StaffPayAllPreviewItem): StaffPayAllPreviewItem {
  return { ...item, amount: toNum(item.amount) };
}

export const staffSalaryApi = {
  async balance(staffId: number) {
    return normalizeBalance(
      unwrap<StaffSalaryBalance>(await apiClient.get(StaffSalaryApis.balance(staffId))),
    );
  },

  async pay(
    staffId: number,
    payload: {
      amount: number;
      payment_method?: string;
      reason?: string;
      reference?: string;
      account_type: "drawer" | "bank";
      account_id: number;
    },
  ) {
    return normalizeTransaction(
      unwrap<StaffSalaryTransaction>(
        await apiClient.post(StaffSalaryApis.pay(staffId), payload),
      ),
    );
  },

  async deduct(
    staffId: number,
    payload: { amount: number; reason: string; reference?: string },
  ) {
    return normalizeTransaction(
      unwrap<StaffSalaryTransaction>(
        await apiClient.post(StaffSalaryApis.deduct(staffId), payload),
      ),
    );
  },

  /** What "Pay all" would do, without paying anyone -- lets the UI show a
   * per-staff preview for the user to review before committing. */
  async previewPayAll() {
    const data = unwrap<{ count: number; total_due: number; staff: StaffPayAllPreviewItem[] }>(
      await apiClient.get(StaffSalaryApis.payAllPreview()),
    );
    return data.staff.map(normalizePreviewItem);
  },

  async payAll(payload: { payment_method?: string; reference?: string; reason?: string; account_type: "drawer" | "bank"; account_id: number }) {
    return unwrap<{ paid_count: number; total_paid: string; staff: unknown[] }>(
      await apiClient.post(StaffSalaryApis.payAll(), payload),
    );
  },

  async overtime(staffId: number) {
    return unwrap<StaffOvertimeSummary>(
      await apiClient.get(StaffSalaryApis.overtime(staffId)),
    );
  },

  async resolveOvertime(
    staffId: number,
    payload: { action: "pay" | "discard"; hourly_rate?: number; account_type?: "drawer" | "bank"; account_id?: number },
  ) {
    return unwrap<{
      staff_id: number;
      resolved_minutes: number;
      action: string;
      transaction_id: number | null;
    }>(await apiClient.post(StaffSalaryApis.resolveOvertime(staffId), payload));
  },

  async updateSelfDiscount(staffId: number, selfDiscountPercent: number | null) {
    return unwrap<Record<string, unknown>>(
      await apiClient.patch(StaffSalaryApis.selfDiscount(staffId), {
        self_discount_percent: selfDiscountPercent,
      }),
    );
  },

  async updateAttendanceBasedSalary(staffId: number, enabled: boolean) {
    return unwrap<Record<string, unknown>>(
      await apiClient.patch(StaffSalaryApis.attendanceBasedSalary(staffId), {
        attendance_based_salary: enabled,
      }),
    );
  },
};
