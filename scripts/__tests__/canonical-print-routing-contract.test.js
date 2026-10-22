const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Electron network transport preserves canonical binary payloads", () => {
  const main = read("main.js");
  assert.match(main, /options\.payloadBase64/);
  assert.match(main, /Buffer\.from\(payloadBase64, ["']base64["']\)/);
});

test("receipt and KOT network paths request backend-rendered payloads", () => {
  const receipt = read("app/(dashboard)/orders/[id]/receipt/page.tsx");
  const kot = read("components/receipts/global-kot-printer.tsx");

  assert.match(receipt, /receipts\/orders\/\$\{orderId\}\/print-payload/);
  assert.match(receipt, /payloadBase64/);
  assert.match(kot, /kots\/\$\{kotId\}\/print-payload/);
  assert.match(kot, /data\.printer_config/);
  assert.match(kot, /payloadBase64/);
});

test("web designer defaults match backend canonical thermal defaults", () => {
  for (const file of [
    "components/manage/settings/receipt-designer.tsx",
    "components/manage/settings/kot-designer.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /global_font_size: 11/);
    assert.match(source, /line_spacing: 1\.0/);
    assert.match(source, /column_capacity: 48/);
  }
});

test("designer previews show canonical document identity and selected content", () => {
  const sharedDesigner = read(
    "components/manage/settings/designer-components.tsx",
  );
  const receiptDesigner = read(
    "components/manage/settings/receipt-designer.tsx",
  );
  const kotDesigner = read("components/manage/settings/kot-designer.tsx");

  assert.match(sharedDesigner, /PRE-BILL/);
  assert.match(receiptDesigner, /Estimate - not a tax invoice/);
  assert.match(receiptDesigner, /PAYMENT RECEIPT/);
  assert.match(sharedDesigner, /Tax invoice issued separately/);
  assert.doesNotMatch(sharedDesigner, /NOT PROOF OF PAYMENT/);
  assert.doesNotMatch(sharedDesigner, /NOT A VAT TAX INVOICE/);
  assert.match(sharedDesigner, /LAYOUT PREVIEW/);
  assert.match(sharedDesigner, /context\.items/);
  assert.match(sharedDesigner, /context\.payments/);
  assert.match(sharedDesigner, /amount_in_words/);
  assert.match(receiptDesigner, /fiscalApi\s*\.getProfileOrLegacy/);
  assert.match(receiptDesigner, /receipt_document_settings: documentSettings/);
  assert.match(receiptDesigner, /staff_attribution_mode: "compact"/);
  assert.match(sharedDesigner, /Compact served by/);
  assert.match(sharedDesigner, /Opened, handled and settled/);
  assert.match(sharedDesigner, /Service duration/);
  assert.match(receiptDesigner, /Required fiscal wording is protected/);
  assert.match(
    receiptDesigner,
    /tax_invoice: \{ title: "TAX INVOICE", locked: true \}/,
  );
  assert.match(
    receiptDesigner,
    /credit_note: \{ title: "CREDIT NOTE", locked: true \}/,
  );
  assert.match(kotDesigner, /station_ticket_title/);
  assert.match(kotDesigner, /modifiers/);
  assert.match(kotDesigner, /notes/);
});

test("ordinary receipt presentation distinguishes pre-bills and non-VAT settlements", () => {
  const receipt = read("components/receipts/thermal-receipt.tsx");
  const types = read("types/order.ts");

  assert.match(receipt, /PRE-BILL/);
  assert.match(receipt, /Estimate - not a tax invoice/);
  assert.match(receipt, /PAYMENT RECEIPT/);
  assert.match(receipt, /Not a tax invoice/);
  assert.match(receipt, /Tax invoice issued separately/);
  assert.doesNotMatch(receipt, /NOT PROOF OF PAYMENT/);
  assert.doesNotMatch(receipt, /NOT A VAT TAX INVOICE/);
  assert.match(types, /fiscal_registration_type/);
  assert.match(types, /fiscal_billing_mode/);
});

test("unfinished VAT orders remain pre-bills and viewing does not consume fiscal copies", () => {
  const page = read("app/(dashboard)/orders/[id]/receipt/page.tsx");

  assert.match(page, /receipt\.order\.status !== "completed"/);
  assert.match(
    page,
    /enabled: isActiveVatEbilling && Boolean\(receipt\) && !isPreBill/,
  );
  assert.match(
    page,
    /Viewing a fiscal receipt must never reserve another legal copy number/,
  );
  assert.match(page, /if \(!autoPrintRequested\) return/);
  assert.match(page, /mode=\$\{mode\}/);
});

test("ordinary print audit and customer-facing fiscal status are rendered", () => {
  const page = read("app/(dashboard)/orders/[id]/receipt/page.tsx");
  const saleDetail = read(
    "components/finance/transaction-detail/sales-document-detail-sheet.tsx",
  );
  const receipt = read("components/receipts/thermal-receipt.tsx");
  const fiscal = read("components/receipts/fiscal-receipt.tsx");

  assert.match(page, /print-authorizations/);
  assert.match(saleDetail, /print-authorizations/);
  assert.match(saleDetail, /setShowReceipt\(true\)/);
  assert.match(saleDetail, /setReceipt\(refreshedReceipt\.data\.data/);
  assert.match(saleDetail, /printDesignation=\{ordinaryPrintDesignation\}/);
  assert.match(receipt, /receipt_print_count/);
  assert.match(receipt, /prebill_print_count/);
  assert.match(receipt, /PRINT PREVIEW/);
  assert.match(receipt, /Served by:/);
  assert.match(receipt, /Handled by:/);
  assert.match(receipt, /Settled by:/);
  assert.match(receipt, /service_duration_minutes/);
  assert.match(fiscal, /IRD RECORD SUBMITTED/);
  assert.match(fiscal, /document\.print_count/);
  assert.doesNotMatch(fiscal, /CBMS SYNCED/);
});

test("pre-bills render and route the configured payment QR payload", () => {
  const page = read("app/(dashboard)/orders/[id]/receipt/page.tsx");
  const checkout = read("app/(dashboard)/orders/[id]/checkout/page.tsx");
  const receipt = read("components/receipts/thermal-receipt.tsx");

  assert.match(receipt, /QRCode\.create\(payload/);
  assert.match(receipt, /mode !== "bill" \|\| !paymentQr\?\.payload\.trim\(\)/);
  assert.doesNotMatch(receipt, /<QrCode/);
  assert.match(page, /payment_qr_config_id/);
  assert.match(page, /isPreBill && paymentQr/);
  assert.match(checkout, /configId: qr\.configId/);
});

test("multiple payment QRs require an explicit choice and render centered", () => {
  const page = read("app/(dashboard)/orders/[id]/receipt/page.tsx");
  const receipt = read("components/receipts/thermal-receipt.tsx");

  assert.match(page, /Select payment QR/);
  assert.match(page, /paymentQrs\.length > 1/);
  assert.match(page, /pendingQrPrintIntent/);
  assert.match(page, /selectPaymentQrForPrint/);
  assert.match(receipt, /display: "flex", alignItems: "center"/);
  assert.match(receipt, /justify-center/);
});

test("Electron receipt actions use canonical raw network printing without an OS dialog", () => {
  const receiptPage = read("app/(dashboard)/orders/[id]/receipt/page.tsx");
  const checkout = read("app/(dashboard)/orders/[id]/checkout/page.tsx");
  const saleDetail = read(
    "components/finance/transaction-detail/sales-document-detail-sheet.tsx",
  );
  const transport = read("lib/receipt-network-print.ts");

  assert.match(receiptPage, /await runAutoPrint\(\)/);
  assert.match(receiptPage, /if \(isElectronDesktop\(\)\)/);
  assert.match(receiptPage, /await printRawToReceiptPrinter\(/);
  assert.match(checkout, /receipt\?autoPrint=1/);
  assert.match(saleDetail, /await printRawToReceiptPrinter\(effectiveReceipt/);
  assert.match(saleDetail, /authorization\.render_payload\?\.payload_base64/);
  assert.doesNotMatch(saleDetail, /buildFiscalReceiptRawPayload/);
  assert.match(
    receiptPage,
    /printAuthorization\.render_payload\?\.payload_base64/,
  );
  assert.doesNotMatch(receiptPage, /buildFiscalReceiptRawPayload/);
  assert.match(
    saleDetail,
    /\.fiscal-receipt-printable,\s*\.fiscal-receipt-printable \* \{\s*visibility: visible !important/,
  );
  assert.match(transport, /printNetworkRaw/);
  assert.match(transport, /Settings > Printers/);

  const headerStart = receiptPage.indexOf("Header (no-print)");
  const bannerStart = receiptPage.indexOf("Fully Paid Banner");
  const header = receiptPage.slice(headerStart, bannerStart);
  assert.doesNotMatch(header, /> Refund/);
  assert.doesNotMatch(header, /Complete Order/);
  assert.doesNotMatch(header, /> Share/);
  assert.doesNotMatch(header, /Print Receipt/);
});

test("receipt terminals and designer copy counts remain server-routed", () => {
  const receiptPage = read("app/(dashboard)/orders/[id]/receipt/page.tsx");
  const saleDetail = read(
    "components/finance/transaction-detail/sales-document-detail-sheet.tsx",
  );
  const printerManagement = read(
    "components/manage/settings/printer-management.tsx",
  );
  const receiptDesigner = read(
    "components/manage/settings/receipt-designer.tsx",
  );
  const kotDesigner = read("components/manage/settings/kot-designer.tsx");

  assert.match(printerManagement, /Receipt terminals/);
  assert.match(printerManagement, /Assigned users/);
  assert.match(printerManagement, /PrinterApis\.createReceiptTerminal/);
  assert.match(receiptPage, /Select receipt terminal/);
  assert.match(receiptPage, /receipt_terminal_id: selectedTerminalId/);
  assert.match(receiptPage, /terminal_id=\$\{terminalId\}/);
  assert.match(saleDetail, /receipt_terminal_id: terminalId/);
  assert.match(receiptDesigner, /bill_copies: 1/);
  assert.match(receiptDesigner, /receipt_copies: 1/);
  assert.match(kotDesigner, /print_copies: 1/);
});
