import type {
  PayrollOutstandingItem,
  PayrollPayment,
  PayrollTaxLiabilityRun,
} from "@/lib/payroll/payables";
import type { DrawerCashControlSummary } from "@/types/accounting";

export type PayrollPaymentMethod = "cash" | "bank_transfer";
export type PayrollCashSource = "drawer" | "safe";

export type PayrollAllocationPreview = {
  payrollItemId: number;
  payrollRunId: number;
  dateFrom: string;
  dateTo: string;
  amount: number;
  balanceAfter: number;
};

export type PayrollTaxAllocationPreview = {
  payrollRunId: number;
  dateFrom: string;
  dateTo: string;
  amount: number;
  balanceAfter: number;
};

type PayrollSafeFundingInput = {
  summary: DrawerCashControlSummary | null | undefined;
  hasDisbursementPermission: boolean;
};

export function isPayrollSafeAccountingReady(
  summary: DrawerCashControlSummary | null | undefined,
): boolean {
  return (
    Boolean(summary?.finance_accounting_enabled) &&
    Boolean(summary?.accounting_v2_enabled) &&
    Boolean(summary?.ledger_complete)
  );
}

export function canUsePayrollSafe({
  summary,
  hasDisbursementPermission,
}: PayrollSafeFundingInput): boolean {
  return (
    hasDisbursementPermission && isPayrollSafeAccountingReady(summary)
  );
}

export function payrollSafeFundingError({
  summary,
  hasDisbursementPermission,
  reference,
  amount,
}: PayrollSafeFundingInput & {
  reference: string;
  amount?: number | null;
}): string | null {
  if (!hasDisbursementPermission) {
    return "You do not have permission to disburse cash from the Main Cash / Safe.";
  }
  if (!isPayrollSafeAccountingReady(summary)) {
    return "Main Cash / Safe accounting is not ready. Complete accounting setup before using safe funds.";
  }
  if (reference.trim().length < 2) {
    return "Enter the safe withdrawal voucher or reference.";
  }
  if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
    return "Enter a valid safe-funded amount.";
  }
  if (
    amount != null &&
    amount > Number(summary?.safe_cash || 0) + 0.001
  ) {
    return "This payment exceeds the Main Cash / Safe balance.";
  }
  return null;
}

export function payrollPaymentMethodLabel(method: string): string {
  const normalized = method.trim().toLowerCase().replaceAll("-", "_");
  return (
    {
      cash: "Cash",
      bank: "Bank transfer",
      bank_transfer: "Bank transfer",
      cheque: "Cheque",
      check: "Cheque",
      digital: "Digital wallet",
      wallet: "Digital wallet",
      digital_wallet: "Digital wallet",
    }[normalized] || method.replaceAll("_", " ")
  );
}

export function requiresPayrollBank(method: string): boolean {
  return ["bank", "bank_transfer"].includes(
    method.trim().toLowerCase().replaceAll("-", "_"),
  );
}

export function requiresPayrollReference(
  method: string,
  cashSource?: string | null,
): boolean {
  return (
    requiresPayrollBank(method) ||
    (method.trim().toLowerCase() === "cash" &&
      cashSource?.trim().toLowerCase() === "safe")
  );
}

export function previewPayrollAllocations(
  items: PayrollOutstandingItem[],
  amount: number,
): PayrollAllocationPreview[] {
  let remaining = Math.max(0, Number(amount) || 0);
  return [...items]
    .sort(
      (left, right) =>
        left.date_to.localeCompare(right.date_to) ||
        left.payroll_run_id - right.payroll_run_id ||
        left.payroll_item_id - right.payroll_item_id,
    )
    .flatMap((item) => {
      if (remaining <= 0) return [];
      const outstanding = Math.max(0, Number(item.outstanding_amount) || 0);
      const allocated = Math.min(remaining, outstanding);
      remaining -= allocated;
      if (allocated <= 0) return [];
      return [
        {
          payrollItemId: item.payroll_item_id,
          payrollRunId: item.payroll_run_id,
          dateFrom: item.date_from,
          dateTo: item.date_to,
          amount: allocated,
          balanceAfter: Math.max(0, outstanding - allocated),
        },
      ];
    });
}

export function previewPayrollTaxAllocations(
  runs: PayrollTaxLiabilityRun[],
  amount: number,
): PayrollTaxAllocationPreview[] {
  let remaining = Math.max(0, Number(amount) || 0);
  return [...runs]
    .sort(
      (left, right) =>
        left.date_to.localeCompare(right.date_to) ||
        left.payroll_run_id - right.payroll_run_id,
    )
    .flatMap((run) => {
      if (remaining <= 0) return [];
      const outstanding = Math.max(0, Number(run.outstanding_tax) || 0);
      const allocated = Math.min(remaining, outstanding);
      remaining -= allocated;
      if (allocated <= 0) return [];
      return [
        {
          payrollRunId: run.payroll_run_id,
          dateFrom: run.date_from,
          dateTo: run.date_to,
          amount: allocated,
          balanceAfter: Math.max(0, outstanding - allocated),
        },
      ];
    });
}

export function payrollPaymentSourceLabel(payment: PayrollPayment): string {
  if (payment.payment_bank_name?.trim()) return payment.payment_bank_name;
  if (payment.payment_instrument_name?.trim()) {
    return payment.payment_instrument_name;
  }
  if (payment.cash_source?.trim().toLowerCase() === "safe") {
    return payment.cash_source_name?.trim() || "Main Cash / Safe (1005)";
  }
  if (payment.drawer_session_name?.trim()) return payment.drawer_session_name;
  if (payment.drawer_name?.trim()) return payment.drawer_name;
  if (payment.payment_bank_id) return `Bank #${payment.payment_bank_id}`;
  if (payment.drawer_session_id) {
    return `Cash drawer session #${payment.drawer_session_id}`;
  }
  if (
    payment.metadata_reconstructed ||
    (payment.history_quality && payment.history_quality !== "exact")
  ) {
    return "Legacy source unavailable";
  }
  return payrollPaymentMethodLabel(payment.payment_method);
}

export function payrollRunPaymentErrorMessage(error: any): string {
  const detail = error?.response?.data?.detail;
  const serverMessage =
    (typeof detail === "string" ? detail : detail?.message) ||
    error?.response?.data?.message;
  if (error?.response) {
    return `Payroll run payment failed. No employee payments were recorded.${
      serverMessage ? ` ${serverMessage}` : ""
    }`;
  }
  return "The payment result could not be confirmed because the connection failed. Refresh the payroll run before trying again.";
}
