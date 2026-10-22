"use client";

import type {
  CanonicalFiscalPreview,
  FiscalDocument,
  FiscalDocumentType,
} from "@/lib/fiscal/types";
import {
  fiscalCopyDesignation,
  fiscalDocumentNumberLabel,
  fiscalDocumentTitle,
  isFiscalCbmsPending,
} from "@/lib/fiscal/receipt-print";

type FiscalReceiptProps = {
  document: FiscalDocument;
  copyNumber?: number;
  designation?: string | null;
  preview?: CanonicalFiscalPreview | null;
};

function amount(value: string | number | null | undefined): string {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function fiscalKind(document: FiscalDocument): FiscalDocumentType | undefined {
  return document.document_kind ?? document.document_type;
}

function staffNames(values: unknown): string {
  if (!Array.isArray(values)) return "";
  const names = Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  return names.join(", ");
}

function formatServiceDuration(value: unknown): string {
  const minutes = Math.trunc(Number(value));
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 24 * 60) return "";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hr" : "hrs"}`);
  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(
      `${remainingMinutes} ${remainingMinutes === 1 ? "min" : "mins"}`,
    );
  }
  return parts.join(" ");
}

export function FiscalReceipt({
  document,
  copyNumber,
  designation,
  preview,
}: FiscalReceiptProps) {
  const currency = document.currency || "NPR";
  const cbmsPending = isFiscalCbmsPending(document);
  const metadata = document.metadata_json || {};
  const orderNumber =
    typeof metadata.order_number === "string" ||
    typeof metadata.order_number === "number"
      ? String(metadata.order_number)
      : null;
  const tableName =
    typeof metadata.table_name === "string" ? metadata.table_name : null;
  const operatorName =
    typeof metadata.operator_name === "string" ? metadata.operator_name : null;
  const staffAttribution =
    metadata.staff_attribution && typeof metadata.staff_attribution === "object"
      ? (metadata.staff_attribution as Record<string, unknown>)
      : null;
  const handledBy = staffNames(staffAttribution?.handled_by);
  const openedBy =
    typeof staffAttribution?.opened_by === "string"
      ? staffAttribution.opened_by
      : null;
  const settledBy =
    typeof staffAttribution?.settled_by === "string"
      ? staffAttribution.settled_by
      : null;
  const printTemplate = Array.isArray(metadata.print_template)
    ? (metadata.print_template as Array<Record<string, unknown>>)
    : [];
  const billInfoBlock = printTemplate.find(
    (block) => block.type === "bill_info",
  );
  const billInfoConfig = {
    ...(billInfoBlock || {}),
    ...((billInfoBlock?.config as Record<string, unknown> | undefined) || {}),
  };
  const staffMode = String(
    billInfoConfig.staff_attribution_mode ||
      (billInfoConfig.show_user === false ? "hidden" : "compact"),
  );
  const serviceDuration = formatServiceDuration(
    staffAttribution?.service_duration_minutes,
  );
  const payments = Array.isArray(metadata.payments)
    ? (metadata.payments as Array<{
        method?: string;
        amount?: string | number;
        reference?: string | null;
      }>)
    : [];
  const paidAmount = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const balanceDue = Math.max(
    0,
    Number(document.total_amount || 0) - paidAmount,
  );

  if (preview?.rows?.length) {
    return (
      <>
        <style jsx global>{`
          @media print {
            @page {
              margin: 0 !important;
              size: auto;
            }
            html,
            body {
              width: 80mm !important;
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
              width: 72mm !important;
              max-width: 72mm !important;
              min-width: 72mm !important;
              border: 0 !important;
              box-shadow: none !important;
            }
          }
        `}</style>
        <article className="fiscal-receipt-printable box-border w-[72mm] bg-white px-[1.5mm] py-[3mm] font-mono text-[8px] leading-tight text-black">
          {preview.rows.map((row, index) => (
            <div
              key={`${index}-${row.text}`}
              className="min-h-[1em] whitespace-pre"
              style={{
                textAlign: row.align,
                fontWeight: row.bold ? 800 : 400,
                fontSize:
                  row.height_mult > 1 || row.width_mult > 1 ? "10px" : "8px",
                transform:
                  row.width_mult > 1 ? `scaleX(${row.width_mult})` : undefined,
                transformOrigin:
                  row.align === "right"
                    ? "right center"
                    : row.align === "center"
                      ? "center"
                      : "left center",
              }}
            >
              {row.text || "\u00a0"}
            </div>
          ))}
        </article>
      </>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 0 !important;
            size: auto;
          }
          html,
          body {
            width: 80mm !important;
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
            width: 72mm !important;
            max-width: 72mm !important;
            min-width: 72mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <article className="fiscal-receipt-printable box-border w-[72mm] bg-white px-[1.5mm] py-[3mm] font-mono text-[10px] leading-tight text-black">
        <header className="space-y-1 text-center">
          <h2 className="text-sm font-black">
            {fiscalDocumentTitle(fiscalKind(document))}
          </h2>
          <p className="font-bold">
            {fiscalCopyDesignation(copyNumber, designation)}
          </p>
          {copyNumber === undefined &&
            Number(document.print_count || 0) > 0 && (
              <p className="text-[9px] font-normal">
                Printed {Number(document.print_count)}{" "}
                {Number(document.print_count) === 1 ? "time" : "times"}
              </p>
            )}
          <div className="border-t border-dashed border-black pt-2">
            <p className="font-black">{document.seller_name}</p>
            <p>{document.seller_address}</p>
            <p>PAN: {document.seller_pan}</p>
          </div>
        </header>

        <section className="mt-2 space-y-0.5 border-y border-dashed border-black py-2">
          <div className="flex justify-between gap-2">
            <span>{fiscalDocumentNumberLabel(fiscalKind(document))}</span>
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
          {orderNumber && (
            <div className="flex justify-between gap-2">
              <span>Order</span>
              <span className="text-right">#{orderNumber}</span>
            </div>
          )}
          {tableName && (
            <div className="flex justify-between gap-2">
              <span>Table / service</span>
              <span className="text-right">{tableName}</span>
            </div>
          )}
        </section>

        <section className="space-y-0.5 border-b border-dashed border-black py-2">
          <p>
            Buyer:{" "}
            <span className="font-bold">
              {document.buyer_name || "Consumer"}
            </span>
          </p>
          {document.buyer_address && <p>Address: {document.buyer_address}</p>}
          {document.buyer_pan && <p>Buyer PAN: {document.buyer_pan}</p>}
        </section>

        <section className="py-2">
          <div className="mb-1 grid grid-cols-[minmax(0,1fr)_34px_48px_58px] gap-1 border-b border-black pb-1 font-bold">
            <span>ITEM</span>
            <span className="text-right">QTY</span>
            <span className="text-right">RATE</span>
            <span className="text-right">AMOUNT</span>
          </div>
          {(document.lines || []).map((item, index) => (
            <div key={item.id ?? index} className="mb-1">
              <div className="grid grid-cols-[minmax(0,1fr)_34px_48px_58px] items-start gap-1">
                <span className="min-w-0 break-words">
                  {index + 1}. {item.description}
                </span>
                <span className="text-right">{amount(item.quantity)}</span>
                <span className="text-right">{amount(item.unit_price)}</span>
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
          {payments.length > 0 ? (
            <div className="border-t border-dashed border-black pt-1">
              <p className="font-bold">PAYMENT</p>
              {payments.map((payment, index) => (
                <div key={`${payment.method}-${index}`}>
                  <div className="flex justify-between">
                    <span className="capitalize">
                      {payment.method || "Payment"}
                    </span>
                    <span>
                      {currency} {amount(payment.amount)}
                    </span>
                  </div>
                  {payment.reference && (
                    <p className="text-[9px]">Reference: {payment.reference}</p>
                  )}
                </div>
              ))}
              <div className="flex justify-between font-bold">
                <span>Amount paid</span>
                <span>
                  {currency} {amount(paidAmount)}
                </span>
              </div>
              {balanceDue > 0 && (
                <div className="flex justify-between font-bold">
                  <span>Balance due</span>
                  <span>
                    {currency} {amount(balanceDue)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p>Payment: {document.payment_method || "-"}</p>
          )}
          {staffMode !== "hidden" &&
            (handledBy || openedBy || operatorName) && (
              <div className="mt-1 border-t border-dashed border-black pt-1">
                {staffMode === "opened_settled" ? (
                  <>
                    {openedBy && <p>Opened by: {openedBy}</p>}
                    {handledBy && handledBy !== openedBy && (
                      <p>Handled by: {handledBy}</p>
                    )}
                    {settledBy && <p>Settled by: {settledBy}</p>}
                  </>
                ) : (
                  <p>Served by: {handledBy || openedBy || operatorName}</p>
                )}
                {billInfoConfig.show_service_duration === true &&
                  serviceDuration && <p>Service duration: {serviceDuration}</p>}
              </div>
            )}
        </section>

        {document.cbms_required && (
          <footer
            className={`mt-3 border p-2 text-center font-black ${
              cbmsPending ? "border-black" : "border-dashed border-black"
            }`}
          >
            {cbmsPending ? "FISCAL SUBMISSION PENDING" : "IRD RECORD SUBMITTED"}
            {/*
                  false ? ` · ${document.cbms_reference}` : ""
            */}
          </footer>
        )}
      </article>
    </>
  );
}
