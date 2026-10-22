const BALANCE_EPSILON = 0.004;

export type CustomerBalancePresentation =
  | { kind: "receivable"; amount: number; label: "Receivable" }
  | { kind: "customer-credit"; amount: number; label: "Customer credit" }
  | { kind: "settled"; amount: 0; label: "Settled" }
  | { kind: "unavailable"; amount: null; label: "Balance unavailable" };

/**
 * `net_open` is the authoritative party-statement balance: positive means the
 * customer owes us, negative means we owe the customer. The legacy customer
 * list field is deliberately only a positive receivable projection, so a zero
 * value cannot distinguish settled from customer credit.
 */
export function presentCustomerBalance({
  isAvailable = true,
  legacyReceivable,
  netOpen,
}: {
  isAvailable?: boolean;
  legacyReceivable?: number | null;
  netOpen?: number | null;
}): CustomerBalancePresentation {
  if (!isAvailable) {
    return { kind: "unavailable", amount: null, label: "Balance unavailable" };
  }

  if (typeof netOpen === "number" && Number.isFinite(netOpen)) {
    if (netOpen > BALANCE_EPSILON) {
      return { kind: "receivable", amount: netOpen, label: "Receivable" };
    }
    if (netOpen < -BALANCE_EPSILON) {
      return {
        kind: "customer-credit",
        amount: Math.abs(netOpen),
        label: "Customer credit",
      };
    }
    return { kind: "settled", amount: 0, label: "Settled" };
  }

  if (
    typeof legacyReceivable === "number" &&
    Number.isFinite(legacyReceivable) &&
    legacyReceivable > BALANCE_EPSILON
  ) {
    return {
      kind: "receivable",
      amount: legacyReceivable,
      label: "Receivable",
    };
  }

  return { kind: "unavailable", amount: null, label: "Balance unavailable" };
}
