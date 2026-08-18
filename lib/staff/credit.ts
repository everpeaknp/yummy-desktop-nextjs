import apiClient from "@/lib/api-client";
import { StaffCreditApis, StaffProfileApis } from "@/lib/api/endpoints";

export type StaffCreditDirection =
  | "advance_granted"
  | "repayment_received"
  | "adjustment";

export type StaffCreditTransaction = {
  id: number;
  staff_id: number;
  direction: StaffCreditDirection;
  amount: number;
  payment_method?: string | null;
  reason?: string | null;
  reference?: string | null;
  balance_after?: number | null;
  status: "posted" | "reversed";
  created_by?: number | null;
  created_at: string;
  reversed_at?: string | null;
  reversed_by?: number | null;
  reversal_reason?: string | null;
};

export type StaffCreditBalance = {
  staff_id: number;
  balance: number;
  total_advanced: number;
  total_repaid: number;
};

export type StaffBalanceRow = {
  staff_id: number;
  user_id?: number | null;
  /** Money the business owes this staff member (unpaid salary). */
  payroll_due: number;
  /** Money this staff member owes the business (outstanding advances). */
  credit_balance: number;
  /** payroll_due - credit_balance. Positive: owed to staff. Negative: owed to the business. */
  net_due: number;
};

export type StaffProfileSummary = {
  staff: Record<string, unknown>;
  role_name: string | null;
  permission_keys: string[];
  payroll_balance: Record<string, unknown>;
  credit_balance: StaffCreditBalance;
  recent_attendance: unknown[];
  recent_activity: unknown[];
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

function normalizeTransaction(t: StaffCreditTransaction): StaffCreditTransaction {
  return { ...t, amount: toNum(t.amount), balance_after: toNumOrNull(t.balance_after) };
}

function normalizeBalance(b: StaffCreditBalance): StaffCreditBalance {
  return {
    ...b,
    balance: toNum(b.balance),
    total_advanced: toNum(b.total_advanced),
    total_repaid: toNum(b.total_repaid),
  };
}

export const staffCreditApi = {
  async balance(staffId: number) {
    return normalizeBalance(
      unwrap<StaffCreditBalance>(await apiClient.get(StaffCreditApis.balance(staffId))),
    );
  },

  async transactions(staffId: number) {
    return unwrap<StaffCreditTransaction[]>(
      await apiClient.get(StaffCreditApis.transactions(staffId)),
    ).map(normalizeTransaction);
  },

  async recordAdvance(
    staffId: number,
    payload: { amount: number; payment_method?: string; reason?: string },
  ) {
    return normalizeTransaction(
      unwrap<StaffCreditTransaction>(
        await apiClient.post(StaffCreditApis.advance(staffId), payload),
      ),
    );
  },

  async recordRepayment(
    staffId: number,
    payload: { amount: number; payment_method?: string; reason?: string },
  ) {
    return normalizeTransaction(
      unwrap<StaffCreditTransaction>(
        await apiClient.post(StaffCreditApis.repay(staffId), payload),
      ),
    );
  },

  async reverse(staffId: number, transactionId: number, reason: string) {
    return normalizeTransaction(
      unwrap<StaffCreditTransaction>(
        await apiClient.post(StaffCreditApis.reverse(staffId, transactionId), {
          reason,
        }),
      ),
    );
  },

  async updateDiscountLimit(staffId: number, discountLimitAmount: number | null) {
    return unwrap<Record<string, unknown>>(
      await apiClient.patch(StaffProfileApis.discountLimit(staffId), {
        discount_limit_amount: discountLimitAmount,
      }),
    );
  },

  async balances() {
    const data = unwrap<{ staff: StaffBalanceRow[] }>(
      await apiClient.get(StaffProfileApis.balances()),
    );
    return data.staff.map((row) => ({
      ...row,
      payroll_due: toNum(row.payroll_due),
      credit_balance: toNum(row.credit_balance),
      net_due: toNum(row.net_due),
    }));
  },

  async profile(staffId: number) {
    return unwrap<StaffProfileSummary>(
      await apiClient.get(StaffProfileApis.profile(staffId)),
    );
  },
};
