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
  assert.doesNotMatch(
    source,
    /financeMetrics && financeOverview\?\.payment_method_breakdown\?\.length/,
  );
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

test("analytics station changes cancel superseded requests without double triggering", () => {
  const source = read("app/(dashboard)/analytics/page.tsx");
  const endpoints = read("lib/api/endpoints.ts");
  const stationSelect = source.match(
    /\{\/\* Station Select \*\/\}([\s\S]*?)\{\/\* Business Line Select \*\/\}/,
  );

  assert.ok(stationSelect, "station selector should remain present");
  assert.match(stationSelect[1], /setStation\(/);
  assert.doesNotMatch(stationSelect[1], /setFetchTrigger\(/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /analyticsRequestGenerationRef/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /if \(!isCurrentRequest\(\)\) return/);
  assert.match(source, /AnalyticsApis\.financeSummary/);
  assert.match(source, /fastFinanceOverview/);
  assert.match(source, /fullDashboardResolved/);
  assert.match(source, /if \(!data\?\.tabs && !quick\) return null/);
  assert.match(source, /activeTab === "finance" && fastFinanceOverview/);
  assert.match(endpoints, /financeSummary:/);
  assert.match(endpoints, /\/analytics\/finance-summary/);
});

test("finance station filters share canonical All and General scopes", () => {
  const helper = read("lib/finance-station-scope.ts");
  const sources = [
    read("app/(dashboard)/analytics/page.tsx"),
    read("app/(dashboard)/analytics/compare/page.tsx"),
    read("app/(dashboard)/finance/income/page.tsx"),
    read("app/(dashboard)/finance/expenses/page.tsx"),
  ];

  assert.match(helper, /value: "general"[\s\S]*label: "General \/ Shared"/);
  assert.match(helper, /normalizedBusinessLine === "hotel"/);
  assert.match(helper, /normalizedBusinessLine === "restaurant"/);
  assert.match(helper, /normalized === ALL_FINANCE_STATIONS/);
  for (const source of sources) {
    assert.match(source, /financeStationOptions/);
    assert.match(source, /isFinanceStationAvailable/);
    assert.match(source, /toFinanceStationParam/);
  }
});

test("reporting screens send All as an explicit business-line scope", () => {
  const analyticsSource = read("app/(dashboard)/analytics/page.tsx");
  const compareSource = read("app/(dashboard)/analytics/compare/page.tsx");
  const incomeSource = read("app/(dashboard)/finance/income/page.tsx");
  const expensesSource = read("app/(dashboard)/finance/expenses/page.tsx");
  const menuSource = read("app/(dashboard)/analytics/menu/page.tsx");
  const inventorySource = read("app/(dashboard)/analytics/inventory/page.tsx");
  const kitchenSource = read("app/(dashboard)/analytics/kitchen/page.tsx");
  const staffSource = read("app/(dashboard)/analytics/staff/page.tsx");

  assert.match(analyticsSource, /businessLine: queryBusinessLine \?\? "all"/);
  assert.match(compareSource, /businessLine: showBusinessLine \? businessLine : "all"/);
  assert.match(incomeSource, /business_line: businessLine/);
  assert.doesNotMatch(incomeSource, /businessLine === 'all' \? undefined/);
  assert.match(expensesSource, /const listBusinessLineParam = businessLine;/);
  assert.match(expensesSource, /businessLine: listBusinessLineParam/);
  assert.match(expensesSource, /business_line: listBusinessLineParam/);
  assert.match(menuSource, /businessLine: "all"/);
  assert.match(inventorySource, /businessLine: "all"/);
  for (const source of [kitchenSource, staffSource]) {
    assert.match(source, /businessLine: showBusinessLine \? businessLine : "all"/);
  }
});

test("aggregate analytics never presents one business line as drawer custody", () => {
  const source = read("app/(dashboard)/analytics/page.tsx");

  assert.match(
    source,
    /queryBusinessLine === "restaurant" \|\| queryBusinessLine === "hotel"/,
  );
  assert.match(source, /accountingMode && cashControlSummary/);
  assert.match(
    source,
    /Select Restaurant or Hotel to view drawer cash custody\./,
  );
});

test("analytics omits the transitional finance coverage banner", () => {
  const source = read("app/(dashboard)/analytics/page.tsx");

  assert.doesNotMatch(source, /Transitional finance coverage/);
  assert.doesNotMatch(source, /legacy Other, and unattributed activity/);
});

test("expense writes use canonical attribution independently of reporting All", () => {
  const helper = read("lib/finance-station-scope.ts");
  const source = read("app/(dashboard)/finance/expenses/page.tsx");

  assert.match(helper, /toFinanceAttributionStation/);
  assert.match(source, /station: toFinanceAttributionStation/);
  assert.match(source, /businessLine: expenseWriteBusinessLine/);
  assert.match(source, /includeAll: false/);
  assert.doesNotMatch(source, /station: "other"/);
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

test("unpaid general purchases require a supplier before submit", () => {
  const purchaseSource = read(
    "components/manage/purchases/purchase-dialog.tsx",
  );

  assert.match(purchaseSource, /Supplier is required for unpaid purchases\./);
  assert.match(purchaseSource, /payment_status/);
  assert.match(purchaseSource, /supplier_id/);
});

test("inventory opening stock payment status is captured on the item form", () => {
  const inventorySource = read("app/(dashboard)/inventory/page.tsx");

  assert.match(inventorySource, /opening_stock_payment_status/);
  assert.match(inventorySource, /payment_status/);
});

test("expense page exposes edit and delete actions for recorded expenses", () => {
  const source = read("app/(dashboard)/finance/expenses/page.tsx");

  assert.match(source, /\bhandleEditExpense\b/);
  assert.match(source, /\bhandleDeleteExpense\b/);
  assert.match(source, /ExpenseApis\.update/);
  assert.match(source, /ExpenseApis\.delete/);
  assert.match(source, /Posted financial details are locked/);
  assert.match(source, /immutable after posting/);
  assert.match(
    source,
    /ExpenseApis\.update\(editingExpense\.id\)[\s\S]*?description: payload\.description,[\s\S]*?\}\)[\s\S]*?: await apiClient\.post/,
  );
  assert.match(source, /Inventory Purchases/);
  assert.match(source, /simpleInventoryPurchases/);
  assert.match(source, /Inventory Cash Outflow/);
  assert.match(source, /Accounting expense detail/);
  assert.match(source, /Supplier Payable/);
  assert.match(source, /operatingExpenseTotal = financeExpenseMetrics/);
  assert.match(
    source,
    /financeExpenseMetrics[\s\S]*buildFinanceExpensePaymentMethodBreakdown/,
  );
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

test("inventory item opening stock requires an explicit cash-out account when paid", () => {
  const source = read("app/(dashboard)/inventory/page.tsx");

  assert.match(source, /opening_stock_account_type/);
  assert.match(source, /opening_stock_account_id/);
  assert.match(source, /openingPaymentAccount/);
  assert.match(
    source,
    /isCostedOpeningStock && itemForm\.opening_stock_payment_status === "paid"/,
  );
});

test("paid purchase receipts require an explicit cash-out account, and every purchase requires a supplier", () => {
  const source = read("app/(dashboard)/inventory/purchases/page.tsx");

  assert.match(source, /CashBankAccountSelect/);
  assert.match(
    source,
    /receivePaymentStatus === "paid" && !receiveAccount/,
  );
  assert.match(source, /!user\?\.restaurant_id \|\| !createForm\.supplier_id/);
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
