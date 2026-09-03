import type { FinanceSalesDocument } from "@/types/finance-sales";

import type { TransactionDetailModel } from "./transaction-detail-sheet";

const value = (input: unknown) => Number(input || 0);

const readable = (input: unknown, fallback = "Not recorded") => {
  if (!input) return fallback;
  return String(input)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const amountToneForEntry = (entry: any): "in" | "out" =>
  entry.entry_side === "debt" ? "out" : "in";

export function partyLedgerEntryDetail(
  entry: any,
  party: "customer" | "supplier",
): TransactionDetailModel {
  const isCustomer = party === "customer";
  const isDebt = entry.entry_side === "debt";
  const openAmount = value(entry.open_amount);
  const openLabel = isDebt
    ? isCustomer
      ? "Invoice balance remaining"
      : "Bill balance remaining"
    : isCustomer
      ? "Customer credit available"
      : "Supplier credit available";

  return {
    eyebrow: `${isCustomer ? "Customer" : "Supplier"} transaction`,
    title: entry.display_name || readable(entry.entry_type, "Transaction"),
    reference: entry.source_reference || null,
    subtitle: isDebt
      ? `${isCustomer ? "Sales" : "Purchase"} balance and settlement details.`
      : `Payment or credit recorded for this ${party}.`,
    occurredAt: entry.occurred_at || entry.created_at || entry.financial_date,
    status: entry.status,
    amount: entry.amount,
    amountLabel: isDebt ? (isCustomer ? "Invoice amount" : "Bill amount") : "Amount",
    amountTone: amountToneForEntry(entry),
    badges: [readable(entry.entry_type)],
    sections: [
      {
        title: "Record overview",
        fields: [
          { label: "Transaction type", value: readable(entry.entry_type) },
          { label: "Financial date", value: entry.financial_date || "Not recorded" },
          { label: "Business date", value: entry.business_date || "Not recorded" },
          { label: "Payment method", value: readable(entry.payment_method) },
          { label: isCustomer ? "Received into" : "Paid from", value: entry.account_name || readable(entry.account_type) },
          { label: "Description", value: entry.description || entry.notes || "Not recorded", fullWidth: true },
        ],
      },
      {
        title: "Settlement",
        description: "This shows how much of this open item remains after all recorded allocations.",
        fields: [
          { label: "Original amount", value: `NPR ${value(entry.amount).toFixed(2)}` },
          { label: "Amount applied", value: `NPR ${value(entry.allocated_amount).toFixed(2)}` },
          { label: openLabel, value: `NPR ${openAmount.toFixed(2)}` },
          { label: "Settlement status", value: openAmount <= 0.004 ? "Fully settled" : "Open" },
        ],
      },
    ],
  };
}

export function salesDocumentDetail(document: FinanceSalesDocument): TransactionDetailModel {
  const isReturn = document.document_kind === "credit_note";
  return {
    eyebrow: isReturn ? "Sales return" : "Sales invoice",
    title: document.document_number,
    reference: document.external_reference || document.fiscal_document_number,
    subtitle: isReturn ? "Credit note and return settlement details." : "Invoice, items and settlement details.",
    occurredAt: document.created_at || document.business_date,
    status: document.settlement_status || document.status,
    amount: document.grand_total,
    amountLabel: isReturn ? "Return total" : "Invoice total",
    amountTone: isReturn ? "out" : "in",
    badges: [document.source_type, document.business_line],
    sections: [
      {
        title: "Document overview",
        fields: [
          { label: "Customer", value: document.customer_name || "Walk-in customer" },
          { label: "Business date", value: document.business_date },
          { label: "Source", value: readable(document.source_type) },
          { label: "Settlement", value: readable(document.settlement_status) },
          { label: isReturn ? "Return reason" : "Notes", value: document.reason || document.notes || "Not recorded", fullWidth: true },
        ],
      },
      {
        title: "Items",
        description: "Products and amounts recorded in this document.",
        table: {
          columns: ["Item", "Quantity", "Rate", "Discount", "Tax", "Amount"],
          rows: (document.lines || []).map((line) => [
            line.item_name,
            String(line.quantity),
            `NPR ${value(line.unit_price).toFixed(2)}`,
            `NPR ${value(line.discount_amount).toFixed(2)}`,
            `NPR ${value(line.tax_amount).toFixed(2)}`,
            `NPR ${value(line.line_total).toFixed(2)}`,
          ]),
        },
        emptyText: "No line items were returned for this document.",
      },
      {
        title: "Totals",
        fields: [
          { label: "Subtotal", value: `NPR ${value(document.subtotal).toFixed(2)}` },
          { label: "Discount", value: `NPR ${value(document.discount_total).toFixed(2)}` },
          { label: "Tax", value: `NPR ${value(document.tax_total).toFixed(2)}` },
          { label: "Grand total", value: `NPR ${value(document.grand_total).toFixed(2)}` },
        ],
      },
    ],
  };
}

export function purchaseDocumentDetail(purchase: any): TransactionDetailModel {
  const lines = purchase.items || purchase.purchase_items || purchase.lines || [];
  return {
    eyebrow: "Purchase bill",
    title: purchase.reference_number || `Purchase #${purchase.id}`,
    reference: purchase.invoice_number || purchase.external_reference || null,
    subtitle: "Purchase, received stock and payment details.",
    occurredAt: purchase.created_at || purchase.purchase_date,
    status: purchase.payment_status || purchase.status,
    amount: purchase.total_cost,
    amountLabel: "Purchase total",
    amountTone: "out",
    badges: [purchase.status, purchase.payment_status].filter(Boolean),
    sections: [
      {
        title: "Purchase overview",
        fields: [
          { label: "Supplier", value: purchase.supplier_name || "Not recorded" },
          { label: "Purchase date", value: purchase.purchase_date || "Not recorded" },
          { label: "Payment status", value: readable(purchase.payment_status) },
          { label: "Reference", value: purchase.reference_number || "Not recorded" },
          { label: "Remarks", value: purchase.remarks || purchase.notes || "Not recorded", fullWidth: true },
        ],
      },
      {
        title: "Items received",
        table: {
          columns: ["Item", "Quantity", "Rate", "Amount"],
          rows: lines.map((line: any) => [
            line.item_name || line.name || "Item",
            `${line.quantity ?? line.received_quantity ?? "—"}${line.unit ? ` ${line.unit}` : ""}`,
            `NPR ${value(line.unit_cost ?? line.rate ?? line.unit_price).toFixed(2)}`,
            `NPR ${value(line.total_cost ?? line.line_total ?? line.amount).toFixed(2)}`,
          ]),
        },
        emptyText: "No received-item detail was returned for this purchase.",
      },
      { title: "Total", fields: [{ label: "Purchase total", value: `NPR ${value(purchase.total_cost).toFixed(2)}` }] },
    ],
  };
}

export function purchaseReturnDetail(purchaseReturn: any): TransactionDetailModel {
  const lines = purchaseReturn.items || purchaseReturn.return_items || purchaseReturn.lines || [];
  return {
    eyebrow: "Purchase return",
    title: purchaseReturn.return_number || `Purchase return #${purchaseReturn.id}`,
    reference: purchaseReturn.reference_number || purchaseReturn.purchase_reference || null,
    subtitle: "Returned stock and supplier settlement details.",
    occurredAt: purchaseReturn.created_at || purchaseReturn.return_date,
    status: purchaseReturn.status || purchaseReturn.settlement_type,
    amount: purchaseReturn.total_cost,
    amountLabel: "Return total",
    amountTone: "in",
    badges: [purchaseReturn.settlement_type].filter(Boolean),
    sections: [
      {
        title: "Return overview",
        fields: [
          { label: "Return date", value: purchaseReturn.return_date || "Not recorded" },
          { label: "Settlement outcome", value: readable(purchaseReturn.settlement_type) },
          { label: "Original purchase", value: purchaseReturn.purchase_reference || (purchaseReturn.purchase_id ? "Linked purchase" : "Not recorded") },
          { label: "Reason", value: purchaseReturn.reason || purchaseReturn.notes || "Not recorded", fullWidth: true },
        ],
      },
      {
        title: "Returned items",
        table: {
          columns: ["Item", "Quantity", "Rate", "Amount"],
          rows: lines.map((line: any) => [
            line.item_name || line.name || "Item",
            `${line.quantity ?? "—"}${line.unit ? ` ${line.unit}` : ""}`,
            `NPR ${value(line.unit_cost ?? line.rate ?? line.unit_price).toFixed(2)}`,
            `NPR ${value(line.total_cost ?? line.line_total ?? line.amount).toFixed(2)}`,
          ]),
        },
        emptyText: "No returned-item detail was returned for this purchase return.",
      },
      { title: "Total", fields: [{ label: "Return total", value: `NPR ${value(purchaseReturn.total_cost).toFixed(2)}` }] },
    ],
  };
}

export function settlementAllocationDetail(
  allocation: any,
  party: "customer" | "supplier",
): TransactionDetailModel {
  const isCustomer = party === "customer";
  return {
    eyebrow: `${isCustomer ? "Customer" : "Supplier"} settlement`,
    title: "Payment allocation",
    reference: allocation.source_reference || allocation.target_reference || null,
    subtitle: "A recorded allocation between a payment or credit and an open document.",
    occurredAt: allocation.created_at || allocation.financial_date,
    status: allocation.status || "posted",
    amount: allocation.amount,
    amountLabel: "Amount applied",
    amountTone: "neutral",
    sections: [
      {
        title: "Allocation overview",
        fields: [
          { label: isCustomer ? "Payment or credit" : "Payment or supplier credit", value: allocation.source_reference || allocation.source_display_name || "Recorded settlement" },
          { label: isCustomer ? "Sales invoice" : "Purchase bill", value: allocation.target_reference || allocation.target_display_name || "Open document" },
          { label: "Financial date", value: allocation.financial_date || "Not recorded" },
          { label: "Amount applied", value: `NPR ${value(allocation.amount).toFixed(2)}` },
        ],
      },
    ],
  };
}
