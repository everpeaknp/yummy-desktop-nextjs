import type { TransactionDetailModel } from "@/components/finance/transaction-detail/transaction-detail-sheet";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { FinanceSalesDocument } from "@/types/finance-sales";

function documentReference(value: string) {
  return value.replace(/^([a-z]{2,4})-/i, (prefix) => prefix.toUpperCase());
}

export function salesSettlementLabel(value: string) {
  const labels: Record<string, string> = {
    customer_credit: "Customer credit",
    pending: "Pending",
    refund_now: "Refunded",
    refunded: "Refunded",
  };
  return labels[value.trim().toLowerCase()] || "Recorded";
}

export function originalSaleLabel(
  document: FinanceSalesDocument,
  originalSale?: FinanceSalesDocument,
) {
  if (originalSale?.document_number) {
    return `Sale ${documentReference(originalSale.document_number)}`;
  }
  if (document.external_reference)
    return `External sale ${document.external_reference}`;
  return "Original sale not available";
}

export function salesReturnDetail(
  document: FinanceSalesDocument,
  originalSale?: FinanceSalesDocument,
): TransactionDetailModel {
  const originalSaleReference = originalSaleLabel(document, originalSale);
  const refunded = ["refund_now", "refunded"].includes(
    document.settlement_status,
  );

  return {
    eyebrow: "Sales return",
    title: documentReference(document.document_number),
    reference: document.external_reference || "Credit note",
    subtitle: `Return against ${originalSaleReference.replace(/^Sale /, "sale ")}`,
    occurredAt: document.created_at || document.business_date,
    status: document.status,
    amount: document.grand_total,
    amountLabel: refunded ? "Refunded" : "Customer credit",
    amountTone: "out",
    sections: [
      {
        title: "Return overview",
        fields: [
          { label: "Business date", value: formatDate(document.business_date) },
          {
            label: "Customer",
            value: document.customer_name || "Cash customer",
          },
          { label: "Original sale", value: originalSaleReference },
          {
            label: "Settlement",
            value: salesSettlementLabel(document.settlement_status),
          },
          {
            label: "Reason",
            value: document.reason || "Not recorded",
            fullWidth: true,
          },
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
            formatCurrency(line.unit_price),
            formatCurrency(line.line_total),
          ]),
        },
      },
      {
        title: "Totals",
        fields: [
          ...(Number(document.tax_total) > 0
            ? [
                {
                  label: "Tax reversed",
                  value: formatCurrency(document.tax_total),
                },
              ]
            : []),
          { label: "Notes", value: document.notes || "None", fullWidth: true },
        ],
      },
    ],
  };
}
