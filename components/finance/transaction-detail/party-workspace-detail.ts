import type {
  FinanceSalesDocument,
  FinanceSalesDocumentSettlement,
} from "@/types/finance-sales";

import type { TransactionDetailModel } from "./transaction-detail-sheet";

const value = (input: unknown) => Number(input || 0);

const readable = (input: unknown, fallback = "Not recorded") => {
  if (!input) return fallback;
  return String(input)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

function amountToneForEntry(
  entry: any,
  party: "customer" | "supplier",
): "in" | "out" | "neutral" {
  const type = String(entry.entry_type || "").toLowerCase();
  if (entry.entry_side === "debt") return "neutral";
  if (party === "customer") {
    return type.includes("payment_out") || type.includes("refund") ? "out" : "in";
  }
  return type.includes("refund") || type.includes("received") ? "in" : "out";
}

function allocationHistory(
  entry: any,
  party: "customer" | "supplier",
  allocations: any[] = [],
) {
  const isDebt = entry.entry_side === "debt";
  const relevant = allocations.filter((allocation) =>
    isDebt
      ? Number(allocation.target_entry_id) === Number(entry.id)
      : Number(allocation.source_entry_id) === Number(entry.id),
  );
  const documentLabel = party === "customer" ? "Sales invoice" : "Purchase bill";
  return {
    title: isDebt ? "Settlement history" : "Applied to",
    description: isDebt
      ? `Payments and credits recorded against this ${documentLabel.toLowerCase()}.`
      : "Documents this payment or credit was applied to.",
    table: {
      columns: [isDebt ? "Payment or credit" : documentLabel, "Date", "Amount"],
      rows: relevant.map((allocation) => [
        isDebt
          ? allocation.source_reference || allocation.source_display_name || "Recorded payment"
          : allocation.target_reference || allocation.target_display_name || documentLabel,
        allocation.financial_date || allocation.allocation_date || "Not recorded",
        `NPR ${value(allocation.amount).toFixed(2)}`,
      ]),
    },
    emptyText: isDebt
      ? "No payment or credit has been applied yet."
      : "This payment has not been applied to a document yet.",
  };
}

export function partyLedgerEntryDetail(
  entry: any,
  party: "customer" | "supplier",
  allocations: any[] = [],
): TransactionDetailModel {
  const isCustomer = party === "customer";
  const isDebt = entry.entry_side === "debt";
  const tone = amountToneForEntry(entry, party);
  const openAmount = value(entry.open_amount);
  const openLabel = isDebt
    ? isCustomer
      ? "Invoice balance remaining"
      : "Bill balance remaining"
    : isCustomer
      ? "Customer credit available"
      : "Supplier credit available";

  return {
    eyebrow: isDebt
      ? `${isCustomer ? "Customer" : "Supplier"} balance`
      : `${isCustomer ? "Customer" : "Supplier"} payment`,
    title: entry.display_name || readable(entry.entry_type, "Transaction"),
    reference: entry.source_reference || null,
    subtitle: isDebt
      ? `${isCustomer ? "Sales invoice" : "Purchase bill"} settlement details.`
      : tone === "out"
        ? `Payment made to this ${party}.`
        : `Payment received from this ${party}.`,
    occurredAt: entry.occurred_at || entry.created_at || entry.financial_date,
    status: entry.status,
    amount: entry.amount,
    amountLabel: isDebt
      ? isCustomer
        ? "Invoice total"
        : "Bill total"
      : tone === "out"
        ? "Payment out"
        : "Payment received",
    amountTone: tone,
    sections: [
      {
        title: isDebt ? "Document details" : "Payment details",
        fields: [
          { label: "Business date", value: entry.business_date || "Not recorded" },
          ...(!isDebt
            ? [
                { label: "Payment method", value: readable(entry.payment_method) },
                {
                  label: tone === "out" ? "Paid from" : "Received into",
                  value: entry.account_name || readable(entry.account_type),
                },
              ]
            : []),
          {
            label: "Notes",
            value: entry.description || entry.notes || "Not recorded",
            fullWidth: true,
          },
        ],
      },
      {
        title: "Settlement",
        description: "This shows how much of this open item remains after all recorded allocations.",
        fields: [
          ...(value(entry.allocated_amount) > 0
            ? [
                {
                  label: "Amount applied",
                  value: `NPR ${value(entry.allocated_amount).toFixed(2)}`,
                },
              ]
            : []),
          ...(openAmount > 0.004
            ? [{ label: openLabel, value: `NPR ${openAmount.toFixed(2)}` }]
            : []),
          { label: "Settlement status", value: openAmount <= 0.004 ? "Fully settled" : "Open" },
        ],
      },
      allocationHistory(entry, party, allocations),
    ],
  };
}

export function salesDocumentDetail(
  document: FinanceSalesDocument,
  settlement?: FinanceSalesDocumentSettlement | null,
): TransactionDetailModel {
  const isReturn = document.document_kind === "credit_note";
  const received = value(settlement?.amount_received);
  const balanceDue = value(settlement?.balance_due);
  const settlementStatus = settlement?.settlement_status || document.settlement_status || document.status;
  return {
    eyebrow: isReturn
      ? "Sales return"
      : document.source_type === "pos_order"
        ? "POS sale"
        : "Sales invoice",
    title: document.document_number,
    reference:
      document.fiscal_document_number ||
      document.external_reference ||
      (document.source_type === "pos_order" ? "POS invoice" : "Sales invoice"),
    subtitle: isReturn
      ? document.original_document_id
        ? `Return against invoice #${document.original_document_id}`
        : "Sales credit note"
      : document.daily_order_number
        ? `Daily order #${document.daily_order_number}`
        : "Sales invoice",
    occurredAt: document.created_at || document.business_date,
    status: settlementStatus,
    amount: document.grand_total,
    amountLabel: isReturn ? "Return total" : "Invoice total",
    amountTone: isReturn ? "out" : "in",
    sections: [
      {
        title: isReturn ? "Return overview" : "Invoice overview",
        fields: [
          { label: "Business date", value: document.business_date },
          { label: "Customer", value: document.customer_name || "Cash customer" },
          {
            label: isReturn ? "Reason" : "Notes",
            value: document.reason || document.notes || "Not recorded",
            fullWidth: true,
          },
        ],
      },
      {
        title: isReturn ? "Returned items" : "Items",
        description: isReturn
          ? "Items and values reversed by this credit note."
          : "Products and amounts recorded on this invoice.",
        table: {
          columns: ["Item", "Quantity", "Rate", "Amount"],
          rows: (document.lines || []).map((line) => [
            line.item_name,
            String(line.quantity),
            `NPR ${value(line.unit_price).toFixed(2)}`,
            `NPR ${value(line.line_total).toFixed(2)}`,
          ]),
        },
        emptyText: "No line items were returned for this document.",
      },
      ...(!isReturn && settlement
        ? [
            {
              title: "Settlement",
              description:
                balanceDue > 0.004
                  ? "This sale was recorded on credit. Later payments reduce the customer balance."
                  : "Payments recorded against this invoice.",
              fields: [
                ...(balanceDue > 0.004
                  ? [{ label: "Sold on credit", value: `NPR ${value(document.grand_total).toFixed(2)}` }]
                  : []),
                { label: "Received", value: `NPR ${received.toFixed(2)}` },
                { label: "Remaining", value: `NPR ${balanceDue.toFixed(2)}` },
              ],
            },
            {
              title: "Payment history",
              description: "Payments applied to this invoice.",
              table: {
                columns: ["Date", "Method", "Amount"],
                rows: (settlement.payments || []).map((payment) => [
                  payment.received_at,
                  readable(payment.payment_method, "Payment received"),
                  `NPR ${value(payment.amount).toFixed(2)}`,
                ]),
              },
              emptyText: "No payment has been received for this invoice yet.",
            },
          ]
        : []),
      ...(value(document.discount_total) > 0 || value(document.tax_total) > 0
        ? [
            {
            title: "Invoice totals",
              fields: [
                ...(value(document.discount_total) > 0
                  ? [{ label: "Discount", value: `NPR ${value(document.discount_total).toFixed(2)}` }]
                  : []),
                ...(value(document.tax_total) > 0
                  ? [{ label: "Tax", value: `NPR ${value(document.tax_total).toFixed(2)}` }]
                  : []),
                ...(!isReturn
                  ? [
                      {
                        label: "Fiscal document",
                        value: document.fiscal_document_number || "Not issued",
                      },
                    ]
                  : []),
              ],
            },
          ]
        : !isReturn
          ? [
              {
                title: "Invoice totals",
                fields: [
                  {
                    label: "Fiscal document",
                    value: document.fiscal_document_number || "Not issued",
                  },
                ],
              },
            ]
          : []),
    ],
  };
}

export function purchaseDocumentDetail(
  purchase: any,
  statement?: { entries?: any[]; allocations?: any[] } | null,
  relatedReturns: any[] = [],
): TransactionDetailModel {
  const lines = purchase.items || purchase.purchase_items || purchase.lines || [];
  const ledgerEntry = (statement?.entries || []).find(
    (entry: any) =>
      String(entry.source_type || "").toLowerCase() === "inventory_purchase" &&
      Number(entry.source_id) === Number(purchase.id),
  );
  const paidAmount = ledgerEntry ? value(ledgerEntry.allocated_amount) : value(purchase.paid_amount);
  const balanceDue = ledgerEntry ? value(ledgerEntry.open_amount) : value(purchase.remaining_amount);
  const paymentStatus = balanceDue <= 0.004
    ? "Fully paid"
    : paidAmount > 0
      ? "Partially paid"
      : "Unpaid";
  const paymentRows = ledgerEntry
    ? (statement?.allocations || [])
        .filter((allocation: any) => Number(allocation.target_entry_id) === Number(ledgerEntry.id))
        .map((allocation: any) => [
          allocation.source_reference || allocation.source_display_name || "Supplier payment",
          allocation.financial_date || allocation.allocation_date || "Not recorded",
          `NPR ${value(allocation.amount).toFixed(2)}`,
        ])
    : [];
  const returnRows = relatedReturns
    .filter((purchaseReturn) => Number(purchaseReturn.purchase_id) === Number(purchase.id))
    .map((purchaseReturn) => [
      purchaseReturn.return_number || `Purchase return #${purchaseReturn.id}`,
      purchaseReturn.return_date || purchaseReturn.created_at || "Not recorded",
      `NPR ${value(purchaseReturn.total_cost).toFixed(2)}`,
    ]);
  return {
    eyebrow: "Purchase bill",
    title: `Purchase #${purchase.id}`,
    reference: purchase.reference_number || purchase.invoice_number || purchase.external_reference || null,
    subtitle: purchase.supplier_name || "Supplier purchase",
    occurredAt: purchase.created_at || purchase.purchase_date,
    status: paymentStatus,
    amount: purchase.total_cost,
    amountLabel: "Purchase total",
    amountTone: "out",
    sections: [
      {
        title: "Purchase overview",
        fields: [
          { label: "Supplier", value: purchase.supplier_name || "Not recorded" },
          { label: "Purchase date", value: purchase.purchase_date || "Not recorded" },
          { label: "Supplier reference", value: purchase.reference_number || "Not recorded" },
          {
            label: "Remarks",
            value: purchase.remarks || purchase.notes || "Not recorded",
            fullWidth: true,
          },
        ],
      },
      {
        title: "Items received",
        description: "Ordered and received quantities for each inventory item.",
        table: {
          columns: ["Item", "Ordered", "Received", "Unit cost", "Amount"],
          rows: lines.map((line: any) => {
            const unit = line.purchase_unit || line.item_unit || line.unit || "";
            return [
              line.item_name || line.name || "Item",
              `${line.ordered_quantity ?? line.quantity ?? "—"}${unit ? ` ${unit}` : ""}`,
              `${line.received_quantity ?? line.quantity ?? "—"}${unit ? ` ${unit}` : ""}`,
              `NPR ${value(line.unit_cost ?? line.rate ?? line.unit_price).toFixed(2)}`,
              `NPR ${value(line.total_cost ?? line.line_total ?? line.amount).toFixed(2)}`,
            ];
          }),
        },
        emptyText: "No received-item detail was returned for this purchase.",
      },
      {
        title: "Settlement",
        description: "Payments recorded against this supplier bill.",
        fields: [
          { label: "Paid", value: `NPR ${paidAmount.toFixed(2)}` },
          { label: "Balance due", value: `NPR ${balanceDue.toFixed(2)}` },
          { label: "Payment status", value: paymentStatus },
        ],
      },
      {
        title: "Payment history",
        description: "Payments applied to this purchase bill.",
        table: {
          columns: ["Payment", "Date", "Amount"],
          rows: paymentRows,
        },
        emptyText: "No payment has been applied to this purchase yet.",
      },
      ...(returnRows.length
        ? [{
            title: "Related returns",
            table: {
              columns: ["Return", "Date", "Amount"],
              rows: returnRows,
            },
          }]
        : []),
    ],
  };
}

export function purchaseReturnDetail(purchaseReturn: any): TransactionDetailModel {
  const lines = purchaseReturn.items || purchaseReturn.return_items || purchaseReturn.lines || [];
  const refundReceived = purchaseReturn.settlement_type === "refund_received";
  return {
    eyebrow: "Purchase return",
    title: purchaseReturn.return_number || `Purchase return #${purchaseReturn.id}`,
    reference: purchaseReturn.reference_number || purchaseReturn.purchase_reference || null,
    subtitle: refundReceived
      ? "Returned stock and refund received details."
      : "Returned stock and supplier credit details.",
    occurredAt: purchaseReturn.created_at || purchaseReturn.return_date,
    status: purchaseReturn.status || purchaseReturn.settlement_type,
    amount: purchaseReturn.total_cost,
    amountLabel: "Return total",
    amountTone: "in",
    sections: [
      {
        title: "Return overview",
        fields: [
          { label: "Supplier", value: purchaseReturn.supplier_name || "Not recorded" },
          { label: "Original purchase", value: purchaseReturn.purchase_reference || (purchaseReturn.purchase_id ? "Linked purchase" : "Not recorded") },
          { label: "Reason", value: readable(purchaseReturn.reason_code || purchaseReturn.reason || purchaseReturn.notes), fullWidth: true },
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
      {
        title: "Settlement",
        description: refundReceived
          ? "The supplier refunded this purchase return."
          : "This return was recorded as supplier credit.",
        fields: [
          { label: "Settlement type", value: readable(purchaseReturn.settlement_type) },
          ...(refundReceived
            ? [{ label: "Received into", value: readable(purchaseReturn.account_type) }]
            : []),
        ],
      },
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
        ],
      },
    ],
  };
}
