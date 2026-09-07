import type { TransactionDetailModel } from "@/components/finance/transaction-detail/transaction-detail-sheet";
import type { FinanceSalesDocument } from "@/types/finance-sales";

function formatMoney(value: number | string) {
  return `NPR ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function originalSaleLabel(
  document: FinanceSalesDocument,
  originalSale?: FinanceSalesDocument,
) {
  if (originalSale?.document_number) return `Sale ${originalSale.document_number}`;
  if (document.external_reference) return `External sale ${document.external_reference}`;
  return "Original sale not available";
}

export function salesReturnDetail(
  document: FinanceSalesDocument,
  originalSale?: FinanceSalesDocument,
): TransactionDetailModel {
  const originalSaleReference = originalSaleLabel(document, originalSale);
  const refunded = ["refund_now", "refunded"].includes(document.settlement_status);

  return {
    eyebrow: "Sales return",
    title: document.document_number,
    reference: document.external_reference || "Credit note",
    subtitle: `Return against ${originalSaleReference.toLowerCase()}`,
    occurredAt: document.created_at || document.business_date,
    status: document.status,
    amount: document.grand_total,
    amountLabel: refunded ? "Refunded" : "Customer credit",
    amountTone: "out",
    sections: [
      {
        title: "Return overview",
        fields: [
          { label: "Business date", value: document.business_date },
          { label: "Customer", value: document.customer_name || "Cash customer" },
          { label: "Original sale", value: originalSaleReference },
          { label: "Settlement", value: document.settlement_status.replaceAll("_", " ") },
          { label: "Reason", value: document.reason || "Not recorded", fullWidth: true },
        ],
      },
      {
        title: "Returned items",
        description: "Items and values reversed by this credit note.",
        table: {
          columns: ["Item", "Quantity", "Rate", "Amount"],
          rows: document.lines.map((line) => [
            line.item_name,
            Number(line.quantity || 0).toLocaleString(),
            formatMoney(line.unit_price),
            formatMoney(line.line_total),
          ]),
        },
      },
      {
        title: "Totals",
        fields: [
          ...(Number(document.tax_total) > 0
            ? [{ label: "Tax reversed", value: formatMoney(document.tax_total) }]
            : []),
          { label: "Notes", value: document.notes || "None", fullWidth: true },
        ],
      },
    ],
  };
}
