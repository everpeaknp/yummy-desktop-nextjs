const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("docs/WEB_UI_SYSTEM_MIGRATION.md");
const sales = read("components/finance/sales/finance-sales-workspace.tsx");
const salesReturns = read(
  "components/finance/sales/finance-sales-returns-workspace.tsx",
);
const purchases = read("components/manage/purchases/purchases-workspace.tsx");
const inventoryPurchases = read("app/(dashboard)/inventory/purchases/page.tsx");
const inventoryPurchaseReturns = read(
  "app/(dashboard)/inventory/purchases/returns/page.tsx",
);
const sidebar = read("components/layout/sidebar.tsx");
const transactions = read(
  "components/finance/workspace/finance-transactions-client.tsx",
);
const journals = read(
  "components/finance/workspace/manual-journals-client.tsx",
);
const salesDetail = read(
  "components/finance/transaction-detail/sales-document-detail-sheet.tsx",
);
const salesReturnDetail = read(
  "components/finance/transaction-detail/sales-return-detail.tsx",
);
const transactionDetail = read(
  "components/finance/transaction-detail/transaction-detail-sheet.tsx",
);
const refunds = read(
  "components/finance/reports/operational-finance-report-client.tsx",
);
const expenses = read("app/(dashboard)/finance/expenses/page.tsx");

test("Wave 1 has an authoritative finance-register migration matrix", () => {
  assert.match(migration, /## Remaining migration matrix/);
  assert.match(migration, /\/finance\/sales/);
  assert.match(migration, /\|\s+1\s+\|/);
  assert.match(migration, /FOUNDATION-COMPLIANT/);
});

test("Wave 1 keeps tablet touch-first and desktop tables bounded", () => {
  for (const source of [
    sales,
    salesReturns,
    purchases,
    inventoryPurchases,
    inventoryPurchaseReturns,
    transactions,
    journals,
  ]) {
    assert.match(source, /lg:hidden/);
    assert.match(source, /lg:block/);
  }
});

test("Wave 1 uses shared money formatting while retaining source detail sheets", () => {
  for (const source of [
    sales,
    salesReturns,
    transactions,
    journals,
    salesDetail,
  ]) {
    assert.match(source, /formatCurrency/);
  }
  assert.match(sales, /SalesDocumentDetailSheet/);
  assert.match(salesReturns, /salesReturnDetail/);
});

test("Wave 1 uses the shared human date and configured currency boundary", () => {
  for (const source of [sales, salesReturns, purchases, journals, refunds]) {
    assert.match(source, /formatDate/);
  }
  assert.doesNotMatch(refunds, /Rs\./);
  assert.match(transactionDetail, /formatDateTime/);
  assert.match(salesReturnDetail, /formatCurrency/);
});

test("Wave 1 purchase and sales actions stay contextual", () => {
  assert.doesNotMatch(purchases, /backHref=/);
  assert.doesNotMatch(inventoryPurchases, /backHref=/);
  assert.doesNotMatch(inventoryPurchaseReturns, /backHref=/);
  assert.match(purchases, /table-fixed/);
  assert.match(inventoryPurchases, /table-fixed/);
  assert.match(purchases, /Return Item/);
  assert.match(inventoryPurchases, /Return items/);
  assert.match(inventoryPurchases, /Actions for purchase/);
  assert.doesNotMatch(purchases, /className="text-orange-700"/);
  assert.match(
    sales,
    /text-muted-foreground transition-colors hover:text-foreground/,
  );
});

test("Finance owns purchase routes before generic Inventory matching", () => {
  assert.match(sidebar, /"\/inventory": \["\/inventory\/purchases"\]/);
  assert.match(sidebar, /isExcludedRoute\(pathname, item\.href\)/);
  assert.match(inventoryPurchases, /min-w-\[820px\] table-fixed/);
  assert.doesNotMatch(inventoryPurchases, /min-w-\[980px\] table-fixed/);
});

test("Wave 1 keeps synthetic expenses read-only without restricting source expenses", () => {
  assert.match(expenses, /startsWith\("finance_event:"\)/);
  assert.match(expenses, /readOnlyFinanceRow/);
  assert.match(expenses, /aria-label="Edit expense"/);
  assert.match(expenses, /aria-label="Delete expense"/);
});
