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

test("ordinary receipt presentation distinguishes pre-bills and non-VAT settlements", () => {
  const receipt = read("components/receipts/thermal-receipt.tsx");
  const types = read("types/order.ts");

  assert.match(receipt, /ESTIMATE \/ PRE-BILL/);
  assert.match(receipt, /NOT A TAX INVOICE/);
  assert.match(receipt, /NOT PROOF OF PAYMENT/);
  assert.match(receipt, /PAYMENT RECEIPT/);
  assert.match(receipt, /NOT A VAT TAX INVOICE/);
  assert.match(receipt, /TAX INVOICE ISSUED SEPARATELY/);
  assert.match(types, /fiscal_registration_type/);
  assert.match(types, /fiscal_billing_mode/);
});
