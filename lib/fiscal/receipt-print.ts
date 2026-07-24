import type {
  FiscalDocument,
  FiscalDocumentType,
  PrintAuthorization,
} from "./types";

export function fiscalDocumentTitle(
  kind: FiscalDocumentType | undefined,
): string {
  switch (kind) {
    case "tax_invoice":
      return "TAX INVOICE";
    case "pan_invoice":
      return "INVOICE";
    case "credit_note":
      return "CREDIT NOTE";
    case "debit_note":
      return "DEBIT NOTE";
    case "provisional_bill":
      return "PROVISIONAL BILL - NOT A TAX INVOICE";
    default:
      return "FISCAL DOCUMENT";
  }
}

export function fiscalCopyDesignation(
  copyNumber?: number,
  serverDesignation?: string | null,
): string {
  const authoritativeDesignation = serverDesignation?.trim();
  if (authoritativeDesignation) return authoritativeDesignation;
  if (copyNumber === 0) return "ORIGINAL";
  if (typeof copyNumber === "number" && copyNumber > 0) {
    return `COPY ${copyNumber}`;
  }
  return "PRINT PREVIEW - AUTHORIZATION REQUIRED";
}

export function isFiscalCbmsPending(document: FiscalDocument): boolean {
  if (!document.cbms_required) return false;
  if (document.cbms_synced_at) return false;
  return !["synced", "succeeded"].includes(
    String(document.cbms_sync_status || "").toLowerCase(),
  );
}

function amount(value: string | number | null | undefined): string {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function fiscalKind(document: FiscalDocument): FiscalDocumentType | undefined {
  return document.document_kind ?? document.document_type;
}

export function buildFiscalReceiptRawPayload(
  authorization: PrintAuthorization,
): string {
  const document = authorization.document;
  const currency = document.currency || "NPR";
  const lines: string[] = [
    fiscalDocumentTitle(fiscalKind(document)),
    fiscalCopyDesignation(
      authorization.copy_number,
      authorization.designation,
    ),
    "--------------------------------",
    document.seller_name,
    document.seller_address,
    `PAN: ${document.seller_pan}`,
    "--------------------------------",
    `Invoice: ${document.document_number}`,
    `Fiscal Year: ${document.fiscal_year}`,
    `Transaction Date: ${
      document.transaction_date ||
      document.issued_at ||
      document.business_date ||
      "-"
    }`,
  ];

  if (document.transaction_id) {
    lines.push(`Transaction ID: ${document.transaction_id}`);
  }

  lines.push("--------------------------------");
  lines.push(`Buyer: ${document.buyer_name || "Consumer"}`);
  if (document.buyer_address) {
    lines.push(`Buyer Address: ${document.buyer_address}`);
  }
  if (document.buyer_pan) {
    lines.push(`Buyer PAN: ${document.buyer_pan}`);
  }
  lines.push("--------------------------------");

  for (let index = 0; index < (document.lines || []).length; index += 1) {
    const item = (document.lines || [])[index];
    const code = item.fiscal_code || item.item_code;
    lines.push(`${index + 1}. ${item.description}${code ? ` [${code}]` : ""}`);
    lines.push(
      `   ${amount(item.quantity)} ${item.unit} x ${amount(
        item.unit_price,
      )} = ${amount(item.line_total)}`,
    );
  }

  lines.push("--------------------------------");
  lines.push(`Subtotal: ${currency} ${amount(document.subtotal)}`);
  if (Number(document.discount_amount || 0) > 0) {
    lines.push(
      `Discount: ${currency} ${amount(document.discount_amount)}`,
    );
  }
  lines.push(
    `Taxable Amount: ${currency} ${amount(document.taxable_amount)}`,
  );
  lines.push(
    `Tax Exempt Amount: ${currency} ${amount(
      document.tax_exempt_amount,
    )}`,
  );
  lines.push(`VAT: ${currency} ${amount(document.vat_amount)}`);
  lines.push(`TOTAL: ${currency} ${amount(document.total_amount)}`);
  if (document.amount_in_words) {
    lines.push(`In words: ${document.amount_in_words}`);
  }
  lines.push(`Payment: ${document.payment_method || "-"}`);
  lines.push("--------------------------------");

  if (document.cbms_required) {
    lines.push(
      isFiscalCbmsPending(document)
        ? "CBMS STATUS: PENDING"
        : `CBMS STATUS: SYNCED${
            document.cbms_reference
              ? ` (${document.cbms_reference})`
              : ""
          }`,
    );
  }

  lines.push("\n\n\n");
  return lines.join("\n");
}
