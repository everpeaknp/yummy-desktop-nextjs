const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("income page presents distinct finance-core concepts", () => {
  const source = read("app/(dashboard)/finance/income/page.tsx");

  for (const label of [
    "Net Sales",
    "Collections",
    "Credit Sales",
    "Refunds",
    "Refund Liabilities",
    "Discounts",
    "Manual Income",
    "Operating Profit",
    "Operating Expenses",
  ]) {
    assert.match(source, new RegExp(`label="${label}"`));
  }
  assert.doesNotMatch(source, /label="Total Revenue"/);
  assert.match(source, /payment_method_breakdown/);
  assert.match(source, /payment_instrument_breakdown/);
  assert.match(source, /discount_total/);
  assert.doesNotMatch(
    source,
    /financeMetrics\.net_sales\s*\+\s*financeMetrics\.manual_income_total/,
  );
});

test("analytics finance summary exposes canonical finance metrics", () => {
  const source = read("app/(dashboard)/analytics/page.tsx");

  for (const token of [
    "collectionsTotal",
    "creditSales",
    "refundTotal",
    "refundLiabilities",
    "discountTotal",
    "manualIncomeTotal",
    "cashExpected",
    "cashControlSummary",
    "inventoryCogs",
    "paidOpenOrdersCount",
    "paidOpenOrdersAmount",
  ]) {
    assert.match(source, new RegExp(`\\b${token}\\b`));
  }
  for (const label of [
    "Net Sales",
    "Collections",
    "Credit Sales",
    "Refund Liabilities",
    "Discounts",
    "Cash Expected",
    "Cash in Drawers",
    "Cash in Transit",
    "Paid Open Amount",
  ]) {
    assert.match(source, new RegExp(`label="${label}"`));
  }
  assert.match(source, /title="Cash Control"/);
  assert.match(source, /accountingMode \? \(/);
  assert.match(source, /Inventory Purchases/);
  assert.match(source, /simpleInventoryPurchases/);
});

test("analytics today snapshot preserves legitimate zero values", () => {
  const source = read("app/(dashboard)/analytics/page.tsx");

  assert.doesNotMatch(source, /todayIncome\s*\|\|\s*currentIncome/);
  assert.doesNotMatch(source, /todayExpense\s*\|\|\s*currentExpense/);
});

test("finance screens explain why net sales and collections differ", () => {
  const analyticsSource = read("app/(dashboard)/analytics/page.tsx");
  const incomeSource = read("app/(dashboard)/finance/income/page.tsx");

  for (const source of [analyticsSource, incomeSource]) {
    assert.match(source, /Sales to Cash Reconciliation/);
    assert.match(source, /currentPeriodSalesCollected/);
    assert.match(source, /priorPeriodPaymentsApplied/);
    assert.match(source, /collectionsForOtherPeriodSales/);
    assert.match(source, /uncollectedSalesBalance/);
    assert.match(source, /paidOpenOrdersAmount/);
  }
});

test("finance screens group metrics by business meaning", () => {
  const analyticsSource = read("app/(dashboard)/analytics/page.tsx");
  const incomeSource = read("app/(dashboard)/finance/income/page.tsx");

  for (const source of [analyticsSource, incomeSource]) {
    for (const heading of [
      "Sales Earned",
      "Money Collected",
      "Money Owed",
      "Costs",
      "Exceptions",
    ]) {
      assert.match(source, new RegExp(heading));
    }
  }
});

test("analytics finance summary shows the exact reporting scope", () => {
  const source = read("app/(dashboard)/analytics/page.tsx");

  assert.match(source, /\bfinanceSummaryScopeLabel\b/);
  assert.match(source, /Date range:/);
  assert.match(source, /Station:/);
  assert.match(source, /getActiveDates\(\)/);
});

test("executive dashboard reads sectioned analytics finance metrics", () => {
  const source = read("app/(dashboard)/dashboard/page.tsx");

  for (const token of [
    "analyticsExecutiveMetrics",
    "analyticsFinanceMetrics",
    "readAnalyticsMetric",
    "collections_total",
    "discount_total",
  ]) {
    assert.match(source, new RegExp(`\\b${token}\\b`));
  }
  assert.match(source, /label="Net Sales"/);
  assert.match(source, /label="Collections"/);
  assert.match(source, /label="Discounts"/);
});

test("operational finance reports are exposed as real UI routes", () => {
  const tabs = read("components/finance/finance-section-tabs.tsx");
  const client = read(
    "components/finance/reports/operational-finance-report-client.tsx",
  );

  assert.match(tabs, /href: "\/finance\/reports"/);
  assert.match(tabs, /label: "Reports"/);

  for (const route of [
    "app/(dashboard)/finance/reports/page.tsx",
    "app/(dashboard)/finance/reports/sales-book/page.tsx",
    "app/(dashboard)/finance/reports/invoices/page.tsx",
    "app/(dashboard)/finance/reports/payments/page.tsx",
    "app/(dashboard)/finance/reports/refunds/page.tsx",
    "app/(dashboard)/finance/reports/vat-sales/page.tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(root, route)), `${route} should exist`);
  }

  for (const api of [
    "salesBook",
    "invoices",
    "payments",
    "refunds",
    "vatSales",
  ]) {
    assert.match(client, new RegExp(`FinanceReportApis\\.${api}\\b`));
  }

  for (const label of [
    "Sales Book",
    "Invoices",
    "Payments",
    "Refunds",
    "VAT Sales",
  ]) {
    assert.match(client, new RegExp(label));
  }

  for (const token of [
    "SalesBookReportResponse",
    "InvoiceReportResponse",
    "PaymentReportResponse",
    "RefundReportResponse",
    "VatSalesReportResponse",
  ]) {
    assert.match(client, new RegExp(`\\b${token}\\b`));
  }
});

test("general purchase dialog submits backend payment status values", () => {
  const source = read("components/manage/purchases/purchase-dialog.tsx");

  assert.match(source, /label: "Unpaid", value: "pending"/);
  assert.doesNotMatch(source, /value: "unpaid"/);
  assert.doesNotMatch(source, /payment_status: "unpaid"/);
});

test("unpaid inventory and purchases require a supplier before submit", () => {
  const inventorySource = read("app/(dashboard)/inventory/page.tsx");
  const purchaseSource = read(
    "components/manage/purchases/purchase-dialog.tsx",
  );

  assert.match(
    inventorySource,
    /Supplier is required for unpaid inventory purchases\./,
  );
  assert.match(inventorySource, /opening_stock_payment_status/);
  assert.match(inventorySource, /payment_status/);

  assert.match(purchaseSource, /Supplier is required for unpaid purchases\./);
  assert.match(purchaseSource, /payment_status/);
  assert.match(purchaseSource, /supplier_id/);
});

test("expense page exposes edit and delete actions for recorded expenses", () => {
  const source = read("app/(dashboard)/finance/expenses/page.tsx");

  assert.match(source, /\bhandleEditExpense\b/);
  assert.match(source, /\bhandleDeleteExpense\b/);
  assert.match(source, /ExpenseApis\.update/);
  assert.match(source, /ExpenseApis\.delete/);
  assert.match(source, /Inventory Purchases/);
  assert.match(source, /simpleInventoryPurchases/);
  assert.match(source, /Inventory Cash Outflow/);
  assert.match(source, /Accounting expense detail/);
  assert.match(source, /Supplier Payable/);
  assert.doesNotMatch(
    source,
    /if \(!finance\?\.meta\?\.ledger_complete\) return false;/,
  );
});

test("payable payments use canonical POS payment methods", () => {
  const endpoints = read("lib/api/endpoints.ts");
  const payableDialog = read("components/manage/payments/payment-dialog.tsx");
  const purchaseDialog = read(
    "components/manage/purchases/purchase-dialog.tsx",
  );
  const expensesPage = read("app/(dashboard)/finance/expenses/page.tsx");

  assert.match(
    endpoints,
    /\bupdate:\s*\(id: number\) => `\/expenses\/\$\{id\}`/,
  );
  assert.match(
    endpoints,
    /\bdelete:\s*\(id: number\) => `\/expenses\/\$\{id\}`/,
  );

  for (const source of [payableDialog, purchaseDialog, expensesPage]) {
    assert.match(source, /PAYMENT_METHOD_OPTIONS/);
    assert.doesNotMatch(source, /bank_transfer/);
    assert.doesNotMatch(source, /digital_wallet/);
    assert.doesNotMatch(source, /cheque/);
  }
});

test("payable payment dialog submits selected payment instruments", () => {
  const source = read("components/manage/payments/payment-dialog.tsx");
  const helper = read("lib/payment-instruments.ts");

  assert.match(helper, /extractPaymentInstruments/);
  assert.match(helper, /buildPaymentInstrument/);
  assert.match(source, /useRestaurant/);
  assert.match(source, /selectedStaticQrIndex/);
  assert.match(source, /selectedCardIndex/);
  assert.match(source, /buildPaymentInstrument/);
  assert.match(source, /instrument:/);
  assert.match(source, /staticPaymentQrs\.map/);
  assert.match(source, /staticPaymentCards\.map/);
  assert.match(source, /No QR instruments configured/);
  assert.match(source, /No card instruments configured/);
});

test("inventory paid receipts require explicit cash-out payment method", () => {
  const source = read("app/(dashboard)/inventory/page.tsx");

  assert.match(
    source,
    /CASH_OUT_PAYMENT_METHOD_OPTIONS as PAYMENT_METHOD_OPTIONS/,
  );
  assert.match(source, /opening_stock_payment_method/);
  assert.match(
    source,
    /payload\.payment_method = \(adjustForm as any\)\.payment_method/,
  );
  assert.match(
    source,
    /opening_stock_payment_method:[\s\S]*itemForm\.opening_stock_payment_method/,
  );
  assert.match(source, /Supplier is required for unpaid inventory purchases\./);
});

test("refund payout methods exclude customer credit", () => {
  const shared = read("lib/payment-method-options.ts");
  const checkout = read("app/(dashboard)/orders/[id]/checkout/page.tsx");
  const refundStart = checkout.indexOf('htmlFor="refund-method"');
  const refundEnd = checkout.indexOf('htmlFor="refund-reason"', refundStart);
  const refundBlock = checkout.slice(refundStart, refundEnd);

  assert.match(shared, /REFUND_PAYMENT_METHOD_OPTIONS/);
  assert.match(checkout, /REFUND_PAYMENT_METHOD_OPTIONS/);
  assert.match(checkout, /REFUND_PAYMENT_METHODS\.map/);
  assert.match(refundBlock, /REFUND_PAYMENT_METHODS\.map/);
  assert.doesNotMatch(refundBlock, /\{PAYMENT_METHODS\.map/);
  assert.doesNotMatch(refundBlock, /value="credit"/);
});
