import { describe, expect, it } from "vitest";
import {
  fiscalCopyDesignation,
  fiscalDocumentNumberLabel,
  isFiscalCbmsPending,
} from "./receipt-print";
import type { FiscalDocument } from "./types";

const document: FiscalDocument = {
  id: 9,
  restaurant_id: 3,
  document_kind: "tax_invoice",
  status: "issued",
  fiscal_year: "2083/84",
  document_number: "TI-2083-000001",
  transaction_date: "2083-04-08",
  seller_name: "Yummy Restaurant Pvt. Ltd.",
  seller_address: "Kathmandu",
  seller_pan: "123456789",
  buyer_name: "Acme Nepal",
  buyer_pan: "987654321",
  payment_method: "cash",
  currency: "NPR",
  subtotal: "1000.00",
  discount_amount: "0",
  taxable_amount: "884.96",
  tax_exempt_amount: "0",
  vat_amount: "115.04",
  total_amount: "1000.00",
  cbms_required: true,
  cbms_synced_at: null,
  lines: [
    {
      id: 1,
      fiscal_code: "SVC-001",
      description: "Dinner",
      unit: "plate",
      quantity: "1",
      unit_price: "1000",
      line_total: "1000",
      tax_category: "vat_13",
    },
  ],
};

describe("fiscal receipt print contract", () => {
  it("uses the legally meaningful original/copy designation", () => {
    expect(fiscalCopyDesignation(0, "ORIGINAL")).toBe("ORIGINAL");
    expect(fiscalCopyDesignation(2, "COPY 2")).toBe("COPY 2");
    expect(fiscalCopyDesignation(2)).toBe("COPY 2");
    expect(fiscalCopyDesignation()).toBe("PRINT PREVIEW");
  });

  it("labels each legal document number by its fiscal document type", () => {
    expect(fiscalDocumentNumberLabel("tax_invoice")).toBe("Invoice number");
    expect(fiscalDocumentNumberLabel("credit_note")).toBe("Credit note number");
    expect(fiscalDocumentNumberLabel("provisional_bill")).toBe("Bill number");
  });

  it("marks CBMS complete only when the immutable document says so", () => {
    expect(isFiscalCbmsPending(document)).toBe(true);
    expect(
      isFiscalCbmsPending({
        ...document,
        cbms_synced_at: "2026-07-24T02:30:00Z",
      }),
    ).toBe(false);
  });
});
