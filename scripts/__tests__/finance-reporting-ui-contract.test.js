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
  assert.doesNotMatch(source, /financeMetrics\.net_sales\s*\+\s*financeMetrics\.manual_income_total/);
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
    "Paid Open Amount",
  ]) {
    assert.match(source, new RegExp(`label="${label}"`));
  }
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
  const client = read("components/finance/reports/operational-finance-report-client.tsx");

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

  for (const api of ["salesBook", "invoices", "payments", "refunds", "vatSales"]) {
    assert.match(client, new RegExp(`FinanceReportApis\\.${api}\\b`));
  }

  for (const label of ["Sales Book", "Invoices", "Payments", "Refunds", "VAT Sales"]) {
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
