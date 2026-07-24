"use client";

import type { FiscalDocument, FiscalDocumentType } from "@/lib/fiscal/types";
import {
  fiscalCopyDesignation,
  fiscalDocumentTitle,
  isFiscalCbmsPending,
} from "@/lib/fiscal/receipt-print";

type FiscalReceiptProps = {
  document: FiscalDocument;
  copyNumber?: number;
  designation?: string | null;
};

function amount(value: string | number | null | undefined): string {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function fiscalKind(document: FiscalDocument): FiscalDocumentType | undefined {
  return document.document_kind ?? document.document_type;
}

export function FiscalReceipt({
  document,
  copyNumber,
  designation,
}: FiscalReceiptProps) {
  const currency = document.currency || "NPR";
  const cbmsPending = isFiscalCbmsPending(document);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          .fiscal-receipt-printable,
          .fiscal-receipt-printable * {
            visibility: visible !important;
          }
          .fiscal-receipt-printable {
            position: absolute !important;
            left: 50% !important;
            top: 0 !important;
            transform: translateX(-50%) !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <article className="fiscal-receipt-printable w-[300px] bg-white p-4 font-mono text-[11px] leading-tight text-black">
        <header className="space-y-1 text-center">
          <h2 className="text-sm font-black">
            {fiscalDocumentTitle(fiscalKind(document))}
          </h2>
          <p className="font-bold">
            {fiscalCopyDesignation(copyNumber, designation)}
          </p>
          <div className="border-t border-dashed border-black pt-2">
            <p className="font-black">{document.seller_name}</p>
            <p>{document.seller_address}</p>
            <p>PAN: {document.seller_pan}</p>
          </div>
        </header>

        <section className="mt-2 space-y-0.5 border-y border-dashed border-black py-2">
          <div className="flex justify-between gap-2">
            <span>Invoice</span>
            <span className="text-right font-bold">
              {document.document_number}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Fiscal Year</span>
            <span>{document.fiscal_year}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Date</span>
            <span className="text-right">
              {document.transaction_date ||
                document.issued_at ||
                document.business_date ||
                "-"}
            </span>
          </div>
          {document.transaction_id && (
            <div className="flex justify-between gap-2">
              <span>Transaction ID</span>
              <span className="text-right">{document.transaction_id}</span>
            </div>
          )}
        </section>

        <section className="space-y-0.5 border-b border-dashed border-black py-2">
          <p>
            Buyer: <span className="font-bold">{document.buyer_name || "Consumer"}</span>
          </p>
          {document.buyer_address && <p>Address: {document.buyer_address}</p>}
          {document.buyer_pan && <p>Buyer PAN: {document.buyer_pan}</p>}
        </section>

        <section className="py-2">
          <div className="mb-1 grid grid-cols-[1fr_40px_58px] gap-1 border-b border-black pb-1 font-bold">
            <span>ITEM</span>
            <span className="text-right">QTY</span>
            <span className="text-right">AMOUNT</span>
          </div>
          {(document.lines || []).map((item, index) => (
            <div key={item.id ?? index} className="mb-1">
              <div className="grid grid-cols-[1fr_40px_58px] gap-1">
                <span>
                  {index + 1}. {item.description}
                </span>
                <span className="text-right">{amount(item.quantity)}</span>
                <span className="text-right">{amount(item.line_total)}</span>
              </div>
              <p className="pl-3 text-[9px]">
                {[item.fiscal_code || item.item_code, item.unit]
                  .filter(Boolean)
                  .join(" · ")}
                {" @ "}
                {amount(item.unit_price)}
                {item.tax_category === "exempt" ? " · EXEMPT" : " · VAT 13%"}
              </p>
            </div>
          ))}
        </section>

        <section className="space-y-1 border-t border-double border-black pt-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>
              {currency} {amount(document.subtotal)}
            </span>
          </div>
          {Number(document.discount_amount || 0) > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>
                -{currency} {amount(document.discount_amount)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Taxable</span>
            <span>
              {currency} {amount(document.taxable_amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Exempt</span>
            <span>
              {currency} {amount(document.tax_exempt_amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>VAT</span>
            <span>
              {currency} {amount(document.vat_amount)}
            </span>
          </div>
          <div className="flex justify-between border-t border-black pt-1 text-sm font-black">
            <span>TOTAL</span>
            <span>
              {currency} {amount(document.total_amount)}
            </span>
          </div>
          {document.amount_in_words && (
            <p className="pt-1 text-[9px]">
              In words: {document.amount_in_words}
            </p>
          )}
          <p>Payment: {document.payment_method || "-"}</p>
        </section>

        {document.cbms_required && (
          <footer
            className={`mt-3 border p-2 text-center font-black ${
              cbmsPending ? "border-black" : "border-dashed border-black"
            }`}
          >
            {cbmsPending
              ? "CBMS SYNC PENDING"
              : `CBMS SYNCED${
                  document.cbms_reference
                    ? ` · ${document.cbms_reference}`
                    : ""
                }`}
          </footer>
        )}
      </article>
    </>
  );
}
