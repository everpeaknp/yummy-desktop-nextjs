import type { FiscalDocument, FiscalDocumentType } from "./types";

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
      return "PROVISIONAL BILL";
    default:
      return "FISCAL DOCUMENT";
  }
}

/** The fiscal document number is the legal customer-facing document number. */
export function fiscalDocumentNumberLabel(
  kind: FiscalDocumentType | undefined,
): string {
  switch (kind) {
    case "tax_invoice":
    case "pan_invoice":
      return "Invoice number";
    case "credit_note":
      return "Credit note number";
    case "debit_note":
      return "Debit note number";
    case "provisional_bill":
      return "Bill number";
    default:
      return "Document number";
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
  return "PRINT PREVIEW";
}

export function isFiscalCbmsPending(document: FiscalDocument): boolean {
  if (!document.cbms_required) return false;
  if (document.cbms_synced_at) return false;
  return !["synced", "succeeded"].includes(
    String(document.cbms_sync_status || "").toLowerCase(),
  );
}
