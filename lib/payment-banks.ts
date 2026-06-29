import type { PaymentBank } from "@/types/accounting";

const REVIEW_BANK_NAMES = new Set(["default bank", "legacy bank"]);

export function isReviewBank(bank: Pick<PaymentBank, "name"> | null | undefined): boolean {
  const normalized = String(bank?.name || "").trim().toLowerCase();
  return REVIEW_BANK_NAMES.has(normalized);
}

export function getPaymentBankLabel(bank: Pick<PaymentBank, "name"> | null | undefined): string {
  const name = String(bank?.name || "").trim();
  if (!name) return "Unknown bank";
  if (isReviewBank(bank)) return "Default Bank (Needs Review)";
  return name;
}

export function getPaymentBankDescription(bank: Pick<PaymentBank, "name" | "description"> | null | undefined): string {
  if (isReviewBank(bank)) {
    return "Fallback bank for legacy cards and QRs until the real bank assignment is reviewed.";
  }
  return bank?.description?.trim() || "No description";
}
