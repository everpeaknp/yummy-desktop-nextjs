import type {
  PayrollOutstandingItem,
  PayrollPayment,
} from "@/lib/payroll/payables";

export type PayrollPaymentMethod = "cash" | "bank_transfer";

export type PayrollAllocationPreview = {
  payrollItemId: number;
  payrollRunId: number;
  dateFrom: string;
  dateTo: string;
  amount: number;
  balanceAfter: number;
};

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

export function requiresPayrollReference(method: string): boolean {
  return requiresPayrollBank(method);
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

export function payrollPaymentSourceLabel(payment: PayrollPayment): string {
  if (payment.payment_bank_name?.trim()) return payment.payment_bank_name;
  if (payment.payment_instrument_name?.trim()) {
    return payment.payment_instrument_name;
  }
  if (payment.drawer_session_name?.trim()) return payment.drawer_session_name;
  if (payment.drawer_name?.trim()) return payment.drawer_name;
  if (payment.payment_bank_id) return `Bank #${payment.payment_bank_id}`;
  if (payment.drawer_session_id) {
    return `Cash drawer session #${payment.drawer_session_id}`;
  }
  return payrollPaymentMethodLabel(payment.payment_method);
}
