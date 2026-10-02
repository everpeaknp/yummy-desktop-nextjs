export type AccountingNormalSide = "debit" | "credit";

export function abnormalNormalBalanceMessage(
  normalSide: AccountingNormalSide,
  amount: number | string | null | undefined,
): string | null {
  const numericAmount = Number(amount ?? 0);
  if (!Number.isFinite(numericAmount) || numericAmount >= 0) return null;

  return normalSide === "debit"
    ? "Credit balance requires reconciliation"
    : "Debit balance requires reconciliation";
}
