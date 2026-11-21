export type PurchaseVatEntry = "none" | "rate" | "exact";
export type PurchaseAmountBasis = "inclusive" | "exclusive";
export type PurchaseAmounts = { net: string; vat: string; total: string };

function decimal(value: string, places: number): bigint | null {
  const match = value.trim().match(/^(\d*)(?:\.(\d*))?$/);
  if (!match || (!match[1] && !match[2]) || (match[2]?.length || 0) > places) return null;
  return BigInt((match[1] || "0") + (match[2] || "").padEnd(places, "0"));
}

const cents = (value: bigint) => `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, "0")}`;
const roundedDivide = (value: bigint, divisor: bigint) => (value + divisor / BigInt(2)) / divisor;

export function purchaseAmountFromUnits(quantity: string, unitPrice: string): string | null {
  const units = decimal(quantity, 6);
  const price = decimal(unitPrice, 2);
  if (units === null || price === null || units <= BigInt(0)) return null;
  const amount = roundedDivide(units * price, BigInt(1000000));
  return amount > BigInt(Number.MAX_SAFE_INTEGER) ? null : cents(amount);
}

export function purchaseUnitCost(net: string, quantity: string): string | null {
  const subtotal = decimal(net, 2);
  const units = decimal(quantity, 3);
  if (subtotal === null || units === null || units <= BigInt(0)) return null;
  const cost = roundedDivide(subtotal * BigInt(100000), units);
  return `${cost / BigInt(10000)}.${(cost % BigInt(10000)).toString().padStart(4, "0")}`;
}

/** Bill totals stay authoritative; round VAT once, to the nearest cent. */
export function calculatePurchaseAmounts(amount: string, basis: PurchaseAmountBasis, entry: PurchaseVatEntry, vatInput: string, allowZero = false): { amounts: PurchaseAmounts | null; error: string | null } {
  const entered = decimal(amount, 2);
  if (entered === null || entered < BigInt(0) || (!allowZero && entered === BigInt(0))) return { amounts: null, error: allowZero ? "Enter an amount of zero or more, with up to 2 decimal places." : "Enter an amount greater than zero, with up to 2 decimal places." };
  let vat = BigInt(0);
  if (entry === "rate") {
    const rate = decimal(vatInput, 4);
    if (rate === null || rate <= BigInt(0) || rate > BigInt(1000000)) return { amounts: null, error: "Enter a VAT rate greater than 0 and up to 100%, with up to 4 decimal places." };
    const scale = BigInt(1000000);
    vat = roundedDivide(entered * rate, basis === "inclusive" ? scale + rate : scale);
  } else if (entry === "exact") {
    const exact = decimal(vatInput, 2);
    if (exact === null) return { amounts: null, error: "Enter the VAT amount from the bill, with up to 2 decimal places." };
    vat = exact;
  }
  const net = basis === "inclusive" ? entered - vat : entered;
  const total = basis === "inclusive" ? entered : entered + vat;
  if (net < BigInt(0) || (net === BigInt(0) && (!allowZero || vat !== BigInt(0)))) return { amounts: null, error: "VAT must be less than the total including VAT." };
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) return { amounts: null, error: "This amount is too large." };
  return { amounts: { net: cents(net), vat: cents(vat), total: cents(total) }, error: null };
}
