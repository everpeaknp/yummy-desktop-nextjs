"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterChip } from "@/components/patterns/controls/filter-chip";
import { formatCurrency } from "@/lib/utils";
import { calculatePurchaseAmounts, purchaseAmountFromUnits, type PurchaseAmountBasis, type PurchaseVatEntry, type PurchaseAmounts } from "@/lib/purchase-amounts";

export function PurchaseAmountFields({ initialTotal = "", initialVat = "", disabled = false, onChange, quantity: externalQuantity, idPrefix = "purchase", maxRateDecimals = 4, allowZero = false }: {
  initialTotal?: string;
  initialVat?: string;
  disabled?: boolean;
  onChange: (amounts: PurchaseAmounts | null, rate?: string) => void;
  quantity?: string;
  idPrefix?: string;
  maxRateDecimals?: number;
  allowZero?: boolean;
}) {
  const [amount, setAmount] = useState(initialTotal);
  const [basis, setBasis] = useState<PurchaseAmountBasis>("inclusive");
  const [entry, setEntry] = useState<PurchaseVatEntry>(Number(initialVat) > 0 ? "exact" : "none");
  const [rate, setRate] = useState("");
  const [exact, setExact] = useState(initialVat || "0");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const calculate = (nextAmount = amount, nextBasis = basis, nextEntry = entry, nextRate = rate, nextExact = exact) =>
    nextEntry === "rate" && (nextRate.split(".")[1]?.length || 0) > maxRateDecimals
      ? { amounts: null, error: `VAT rate supports up to ${maxRateDecimals} decimal places.` }
      : calculatePurchaseAmounts(nextAmount, nextBasis, nextEntry, nextEntry === "rate" ? nextRate : nextExact, allowZero);
  const result = calculate();
  const previousQuantity = useRef(externalQuantity);
  useEffect(() => {
    if (previousQuantity.current !== externalQuantity) {
      previousQuantity.current = externalQuantity;
      if (externalQuantity !== undefined && unitPrice !== "") update(purchaseAmountFromUnits(externalQuantity, unitPrice) || "");
    }
  });

  function update(nextAmount = amount, nextBasis = basis, nextEntry = entry, nextRate = rate, nextExact = exact) {
    setAmount(nextAmount); setBasis(nextBasis); setEntry(nextEntry); setRate(nextRate); setExact(nextExact);
    onChange(calculate(nextAmount, nextBasis, nextEntry, nextRate, nextExact).amounts, nextEntry === "rate" ? nextRate : undefined);
  }

  return <fieldset disabled={disabled} className="min-w-0 space-y-3 border-t border-border pt-4">
    <legend className="text-sm font-medium">{externalQuantity === undefined ? "Bill amount & VAT" : "Line amount & VAT"}</legend>
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1" role="group" aria-label="Amount entered">
      <FilterChip className="min-w-0 rounded-lg px-2 text-xs" disabled={disabled} active={basis === "inclusive"} onClick={() => update(amount, "inclusive")}>Includes VAT</FilterChip>
      <FilterChip className="min-w-0 rounded-lg px-2 text-xs" disabled={disabled} active={basis === "exclusive"} onClick={() => update(amount, "exclusive")}>Before VAT</FilterChip>
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-entered-amount`}>{basis === "inclusive" ? "Total including VAT *" : "Amount before VAT *"}</Label>
      <Input id={`${idPrefix}-entered-amount`} autoComplete="off" name="purchase_entered_amount" type="number" inputMode="decimal" min={allowZero ? "0" : "0.01"} step="0.01" required value={amount} onChange={(event) => { setUnitPrice(""); update(event.target.value); }} aria-describedby={`${idPrefix}-amount-help`} />
      <p id={`${idPrefix}-amount-help`} className="text-xs text-muted-foreground">{basis === "inclusive" ? externalQuantity === undefined ? "Enter the final bill total. VAT will be taken out of this amount." : "Enter the total for this line. VAT will be taken out of this amount." : "Enter the price before VAT. VAT will be added to this amount."}</p>
    </div>
    {!disabled ? <details className="rounded-xl border border-border px-3 py-2">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Calculate from quantity & unit price</summary>
      <div className="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2">
        {externalQuantity === undefined ? <div className="space-y-2"><Label htmlFor={`${idPrefix}-amount-quantity`}>Quantity</Label><Input id={`${idPrefix}-amount-quantity`} autoComplete="off" name="purchase_amount_quantity" type="text" inputMode="decimal" value={quantity} onChange={(event) => { setQuantity(event.target.value); update(purchaseAmountFromUnits(event.target.value, unitPrice) || ""); }} /></div> : <p className="text-xs text-muted-foreground">For {externalQuantity || "the entered"} purchase units</p>}
        <div className="space-y-2"><Label htmlFor={`${idPrefix}-amount-unit-price`}>Unit price {basis === "inclusive" ? "including VAT" : "before VAT"}</Label><Input id={`${idPrefix}-amount-unit-price`} autoComplete="off" name="purchase_amount_unit_price" type="text" inputMode="decimal" value={unitPrice} onChange={(event) => { setUnitPrice(event.target.value); update(purchaseAmountFromUnits(externalQuantity ?? quantity, event.target.value) || ""); }} /></div>
      </div>
      <p className="pb-2 text-xs text-muted-foreground">This helper fills the amount above. The total above is what will be recorded.</p>
    </details> : null}
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/70 p-1" role="group" aria-label="VAT entry">
      {([['none', 'No VAT'], ['rate', 'Rate %'], ['exact', 'Exact VAT']] as const).map(([value, label]) => <FilterChip key={value} className="min-w-0 rounded-lg px-2 text-xs" disabled={disabled} active={entry === value} onClick={() => update(amount, basis, value, rate, value === "exact" && entry === "rate" ? result.amounts?.vat || exact : exact)}>{label}</FilterChip>)}
    </div>
    {entry !== "none" ? <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-vat-input`}>{entry === "rate" ? "VAT rate %" : "VAT amount from bill"}</Label>
      <Input id={`${idPrefix}-vat-input`} autoComplete="off" name="purchase_vat_input" type="number" inputMode="decimal" min={entry === "rate" ? maxRateDecimals === 2 ? "0.01" : "0.0001" : "0"} max={entry === "rate" ? "100" : undefined} step={entry === "rate" && maxRateDecimals === 4 ? "0.0001" : "0.01"} required value={entry === "rate" ? rate : exact} onChange={(event) => entry === "rate" ? update(amount, basis, entry, event.target.value) : update(amount, basis, entry, rate, event.target.value)} />
      <p className="text-xs text-muted-foreground">{entry === "rate" ? "Use the rate on the supplier bill. Choose Exact VAT if the bill shows a different rounded amount or mixed rates." : externalQuantity === undefined ? "Copy the VAT amount printed on the bill, including any rounding." : "Copy the VAT for this line, including any rounding. Split bills with different VAT treatments into separate lines."}</p>
    </div> : null}
    {amount !== "" && result.error ? <p role="alert" className="text-xs text-destructive">{result.error}</p> : null}
    <dl className="space-y-2 rounded-xl border border-border p-3 text-sm" aria-live="polite">
      {([['Before VAT', 'net'], ['VAT', 'vat'], ['Total including VAT', 'total']] as const).map(([label, key]) => <div key={key} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd className="max-w-full break-all font-medium tabular-nums">{result.amounts ? formatCurrency(result.amounts[key]) : "—"}</dd></div>)}
    </dl>
  </fieldset>;
}
