import { describe, expect, it } from "vitest";
import {
  buildFiscalReceiptRawPayload,
  fiscalCopyDesignation,
  isFiscalCbmsPending,
} from "./receipt-print";
import type { FiscalDocument, PrintAuthorization } from "./types";

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
  });

  it("builds raw printer content only from the immutable fiscal document", () => {
    const authorization: PrintAuthorization = {
      authorization_id: 77,
      authorization_token: "secret-token",
      expires_at: "2026-07-24T03:00:00Z",
      copy_number: 0,
      designation: "ORIGINAL",
      document,
    };

    const output = buildFiscalReceiptRawPayload(authorization);

    expect(output).toContain("TAX INVOICE");
    expect(output).toContain("TI-2083-000001");
    expect(output).toContain("PAN: 123456789");
    expect(output).toContain("Buyer PAN: 987654321");
    expect(output).toContain("Taxable Amount: NPR 884.96");
    expect(output).toContain("VAT: NPR 115.04");
    expect(output).toContain("CBMS STATUS: PENDING");
    expect(output).not.toContain("secret-token");
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
