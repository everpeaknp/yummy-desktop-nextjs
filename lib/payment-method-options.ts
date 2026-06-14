export type CanonicalPaymentMethod = "cash" | "card" | "fonepay" | "digital" | "credit";

export const PAYMENT_METHOD_OPTIONS: Array<{
  value: CanonicalPaymentMethod;
  label: string;
  description?: string;
}> = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "fonepay", label: "Fonepay" },
  { value: "digital", label: "Digital/QR" },
  { value: "credit", label: "Credit" },
];

export const CASH_OUT_PAYMENT_METHOD_OPTIONS = PAYMENT_METHOD_OPTIONS.filter(
  (method) => method.value !== "credit",
);

export const REFUND_PAYMENT_METHOD_OPTIONS = CASH_OUT_PAYMENT_METHOD_OPTIONS;
