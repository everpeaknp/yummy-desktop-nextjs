const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("finance and operational registers share one transaction detail surface", () => {
  const sources = [
    "components/finance/sales/finance-sales-workspace.tsx",
    "components/finance/workspace/finance-transactions-client.tsx",
    "components/finance/workspace/other-income-client.tsx",
    "components/manage/purchases/purchases-workspace.tsx",
    "app/(dashboard)/finance/expenses/page.tsx",
    "components/inventory/inventory-activity-panel.tsx",
    "components/manage/suppliers/supplier-transactions-dialog.tsx",
  ].map(read);

  for (const source of sources) {
    assert.match(source, /TransactionDetailSheet/);
    assert.match(source, /role="button"/);
    assert.match(source, /event\.key === "Enter"/);
  }
});

test("the shared detail surface is responsive and supports grouped line tables", () => {
  const source = read(
    "components/finance/transaction-detail/transaction-detail-sheet.tsx",
  );

  assert.match(source, /sm:max-w-3xl/);
  assert.match(source, /sm:hidden/);
  assert.match(source, /hidden overflow-x-auto[\s\S]*sm:block/);
  assert.match(source, /section\.table\.rows/);
  assert.match(source, /TransactionDetailSection/);
});

test("other income loads authoritative detail by entry id", () => {
  const source = read("components/finance/workspace/other-income-client.tsx");
  const endpoints = read("lib/api/endpoints.ts");

  assert.match(source, /IncomeApis\.detail\(row\.id/);
  assert.match(source, /income_lines/);
  assert.match(endpoints, /detail: \(id: number, restaurantId: number\)/);
});

test("report statements drill from account totals into exact journal details", () => {
  const statements = read(
    "components/finance/reports/reporting-ledger-report-client.tsx",
  );
  const ledger = read("components/finance/reports/account-ledger-panel.tsx");

  assert.match(statements, /ProfitAndLossView[\s\S]*onSelectHead/);
  assert.match(statements, /BalanceSheetView[\s\S]*onSelectHead/);
  assert.match(statements, /TrialBalanceView[\s\S]*onSelectHead/);
  assert.match(statements, /AccountLedgerPanel/);
  assert.match(ledger, /AccountingApis\.journalEntry\(line\.entry_id/);
  assert.match(ledger, /Complete journal/);
  assert.match(ledger, /TransactionDetailSheet/);
});

test("payments and inventory purchases use the shared transaction detail sheet", () => {
  const payments = read(
    "components/finance/reports/operational-finance-report-client.tsx",
  );
  const inventoryPurchases = read(
    "app/(dashboard)/inventory/purchases/page.tsx",
  );

  assert.match(payments, /Payment overview/);
  assert.match(payments, /TransactionDetailSheet/);
  assert.match(payments, /role="button"/);
  assert.match(inventoryPurchases, /Inventory purchase/);
  assert.match(inventoryPurchases, /TransactionDetailSheet/);
  assert.doesNotMatch(inventoryPurchases, /Purchase Detail Dialog/);
});

test("shared detail metadata hides raw database identifiers", () => {
  const detail = read(
    "components/finance/transaction-detail/transaction-detail-sheet.tsx",
  );
  assert.match(detail, /!normalized\.endsWith\("_id"\)/);
  assert.match(detail, /\(\^\|\\s\)id\$/);
});

test("account statement routes known sales documents before generic ledger detail", () => {
  const ledger = read("components/finance/reports/account-ledger-panel.tsx");
  const salesApi = read("lib/api/finance-sales-api.ts");

  assert.match(
    ledger,
    /Ledger drill-down opens the document that directly generated/,
  );
  assert.match(ledger, /type AccountStatementSourceTarget/);
  assert.match(ledger, /function resolveSourceDocumentTarget/);
  assert.match(ledger, /case "finance_sales_invoice":/);
  assert.match(ledger, /case "finance_sales_credit_note":/);
  assert.match(ledger, /knownSourceTarget\?\.kind === "sale"/);
  assert.match(ledger, /knownSourceTarget\?\.kind === "sales-return"/);
  assert.match(ledger, /source_document_type \|\| selectedLine\.source_type/);
  assert.match(ledger, /source_document_id \|\| selectedLine\.source_id/);
  assert.match(
    ledger,
    /source\.includes\("finance_sales_credit_note"\)[\s\S]*?financeSalesApi\.get\(restaurantId, sourceId\)/,
  );
  assert.match(
    ledger,
    /setSelectedSalesReturn\(\{ document, originalSale \}\)/,
  );
  assert.match(ledger, /Open original sale/);
  assert.match(ledger, /Against sale \$\{line\.related_document_reference\}/);
  assert.match(
    salesApi,
    /get: async \(\s*restaurantId: number,\s*documentId: number,/,
  );
  assert.match(
    ledger,
    /\["order", "order_payment", "order_cancel"\]\.includes\(source\)/,
  );
  assert.match(ledger, /!sourceError \? \(/);
  assert.match(ledger, /sourceError \? \(/);
});

test("new inventory purchases post directly without draft or ordered actions", () => {
  const inventoryPurchases = read(
    "app/(dashboard)/inventory/purchases/page.tsx",
  );

  assert.match(inventoryPurchases, /payment_status: createPaymentStatus/);
  assert.match(inventoryPurchases, /Record purchase/);
  assert.match(inventoryPurchases, /Purchase recorded and stock updated/);
  assert.doesNotMatch(inventoryPurchases, /Save Draft/);
  assert.doesNotMatch(inventoryPurchases, /Mark as Ordered/);
  assert.doesNotMatch(inventoryPurchases, /Complete legacy purchase/);
  assert.doesNotMatch(inventoryPurchases, /PurchaseApis\.receive/);
});
