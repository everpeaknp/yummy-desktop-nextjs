const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Wave 2 routes are recorded as foundation compliant", () => {
  const migration = read("docs/WEB_UI_SYSTEM_MIGRATION.md");

  for (const route of [
    "/finance",
    "/finance/reports",
    "/finance/reports/profit-and-loss",
    "/finance/reports/account-ledger",
    "/finance/reports/refunds",
    "/day-close",
    "/finance/setup",
  ]) {
    assert.match(migration, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(
    migration,
    /Finance reporting and control[\s\S]*FOUNDATION-COMPLIANT/,
  );
});

test("report directory owns discovery while individual reports retain only data filters", () => {
  const directory = read("app/(dashboard)/finance/reports/page.tsx");
  const catalog = read("components/finance/reports/finance-report-catalog.ts");
  const filters = read("components/patterns/controls/filter-bar.tsx");
  const statements = read(
    "components/finance/reports/reporting-ledger-report-client.tsx",
  );
  const operational = read(
    "components/finance/reports/operational-finance-report-client.tsx",
  );
  const departments = read(
    "components/finance/reports/department-breakdown-report-client.tsx",
  );
  const daybook = read("components/finance/accounting/daybook-client.tsx");
  const pageHeader = read("components/patterns/page/page-header.tsx");
  const mobileNavigation = read("lib/mobile-module-navigation.ts");
  const header = read("components/layout/header.tsx");

  assert.match(directory, /reportGroups\.map/);
  assert.match(directory, /Choose the business question/);
  assert.match(catalog, /href: "\/finance\/reports\/profit-and-loss"/);
  assert.match(catalog, /href: "\/finance\/reports\/vat-sales"/);
  assert.doesNotMatch(pageHeader, /showTitleOnMobile/);
  assert.match(mobileNavigation, /import \{ reportGroups \}/);
  assert.match(mobileNavigation, /const financeReportRouteTitles/);
  assert.match(mobileNavigation, /\.\.\.financeReportRouteTitles/);
  assert.match(
    mobileNavigation,
    /\["\/finance\/reports", "Reports", "secondary", "\/finance"\]/,
  );
  assert.match(header, /if \(pathname\.startsWith\("\/finance\/reports\/"\)\)/);

  for (const source of [statements, operational, departments, daybook]) {
    assert.doesNotMatch(
      source,
      /FinanceReportNavigation|Switch report|BackButton|showTitleOnMobile/,
    );
  }

  assert.match(filters, /responsiveAt\?: "md" \| "lg"/);
  assert.match(filters, /responsiveAt === "lg" \? "lg:flex" : "md:flex"/);
  assert.match(filters, /responsiveAt === "lg" \? "lg:hidden" : "md:hidden"/);
  assert.match(statements, /responsiveAt="lg"/);
  assert.match(operational, /responsiveAt="lg"/);
});

test("report tables keep analytical rows below the desktop breakpoint", () => {
  const statements = read(
    "components/finance/reports/reporting-ledger-report-client.tsx",
  );
  const ledger = read("components/finance/reports/account-ledger-panel.tsx");
  const operational = read(
    "components/finance/reports/operational-finance-report-client.tsx",
  );
  const departments = read(
    "components/finance/reports/department-breakdown-report-client.tsx",
  );
  const daybook = read("components/finance/accounting/daybook-client.tsx");

  for (const source of [
    statements,
    ledger,
    operational,
    departments,
    daybook,
  ]) {
    assert.match(source, /lg:hidden/);
    assert.match(source, /lg:block/);
  }
  assert.doesNotMatch(statements, /divide-y[^\n]*md:hidden/);
  assert.doesNotMatch(operational, /DataList[^\n]*md:hidden/);
  assert.match(ledger, /sm:max-w-none lg:max-w-4xl xl:max-w-5xl/);
  assert.match(departments, /responsiveAt="lg"/);
  assert.match(departments, /formatCurrency\(department\.net_profit\)/);
  assert.doesNotMatch(daybook, /`Rs\./);
});

test("Profit and Loss preserves the approved accounting hierarchy", () => {
  const source = read(
    "components/finance/reports/reporting-ledger-report-client.tsx",
  );

  for (const label of [
    "Revenue",
    "Contra revenue",
    "Net revenue",
    "Cost of goods sold",
    "Inventory cost details",
    "Gross profit",
    "Gross margin",
    "Expenses excluding recognised COGS",
    "Net profit",
  ]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /formatCurrency\(asNumber\(value\)\)/);
  assert.match(source, /formatDate\(dateFrom\)/);
});

test("Finance overview has one owner for each control destination", () => {
  const overview = read("components/finance/workspace/finance-home-client.tsx");
  const dayClose = read("app/(dashboard)/day-close/page.tsx");
  const setup = read("app/(dashboard)/finance/setup/page.tsx");

  assert.match(overview, /Current month/);
  assert.doesNotMatch(overview, /Control and review/);
  assert.match(overview, /Needs\s+attention/);
  assert.match(overview, /group: "Cash control"[\s\S]*title: "Day close"/);
  assert.match(overview, /group: "Books and review"[\s\S]*title: "Reports"/);
  assert.match(overview, /group: "Configuration"[\s\S]*title: "Finance setup"/);
  assert.equal((overview.match(/href: "\/finance\/reports"/g) || []).length, 1);
  assert.equal((overview.match(/href: "\/finance\/setup"/g) || []).length, 1);
  assert.equal((overview.match(/href: "\/day-close"/g) || []).length, 1);
  assert.match(dayClose, /aria-label="Day close summary"/);
  assert.match(dayClose, /<dl className=/);
  assert.doesNotMatch(dayClose, /DayCloseMetricCard/);
  assert.match(dayClose, /DayCloseApis\.current/);
  assert.match(dayClose, /DayCloseApis\.generateSnapshot/);
  assert.match(setup, /Accounting structure/);
  assert.match(setup, /Money handling/);
  assert.match(setup, /Tax and control/);
  assert.match(setup, /title: "Taxes & fees"/);
  assert.match(setup, /href: "\/manage\/taxes"/);
});

test("Account Statement keeps source-document-first routing", () => {
  const ledger = read("components/finance/reports/account-ledger-panel.tsx");

  assert.match(ledger, /function resolveSourceDocumentTarget/);
  assert.match(ledger, /case "finance_sales_invoice":/);
  assert.match(ledger, /case "finance_sales_credit_note":/);
  assert.match(ledger, /knownSourceTarget\?\.kind === "sale"/);
  assert.match(ledger, /knownSourceTarget\?\.kind === "sales-return"/);
  assert.match(ledger, /return formatCurrency\(value\)/);
  assert.match(ledger, /return formatDateTime\(value\)/);
  assert.doesNotMatch(
    ledger,
    /line\.debit[^\n]*text-emerald|line\.credit[^\n]*text-rose/,
  );
  assert.match(ledger, /const ACCOUNTING_DIRECTION_AMOUNT_CLASS/);
  assert.match(ledger, /text-foreground/);
});

test("Finance sidebar gives index and child routes exact ownership", () => {
  const sidebar = read("components/layout/sidebar.tsx");

  assert.match(sidebar, /const exactActiveRoutes = new Set\(\["\/finance"\]\)/);
  assert.match(
    sidebar,
    /if \(exactActiveRoutes\.has\(href\)\) return pathname === href/,
  );
  assert.match(sidebar, /"\/inventory": \["\/inventory\/purchases"\]/);
});

test("Refund Register fits desktop and humanizes backend enums", () => {
  const report = read(
    "components/finance/reports/operational-finance-report-client.tsx",
  );

  assert.match(report, /function humanizeEnum/);
  assert.match(report, /humanizeEnum\(row\.payment_method\)/);
  assert.match(report, /humanizeEnum\(row\.instrument_type\)/);
  assert.match(report, /<Table className="w-full table-fixed">/);
  assert.match(report, /w-\[112px\] whitespace-nowrap/);
  assert.match(
    report,
    /w-\[140px\] whitespace-nowrap">\s+Method\s+<\/TableHead>/,
  );
  assert.match(report, /truncate whitespace-nowrap/);
  assert.match(report, /title=\{row\.reference \?\? undefined\}/);
  assert.doesNotMatch(report, /\{row\.payment_method\}/);
});

test("Day Close keeps row actions secondary to the page action", () => {
  const page = read("app/(dashboard)/day-close/page.tsx");
  const historyCard = read(
    "components/analytics/day-close-history-list-card.tsx",
  );
  const history = read("components/analytics/day-close-history.tsx");

  assert.match(page, /className="bg-primary[^"]*"/);
  assert.match(historyCard, /variant="outline"[\s\S]*Close/);
  assert.doesNotMatch(historyCard, /bg-orange-600 hover:bg-orange-700/);
  assert.match(history, /variant="outline"[\s\S]*Close This Day/);
  assert.match(history, /variant="outline"[\s\S]*Re-confirm Day Close/);
});

test("Wave 2B reports use statement, register, and operational archetypes", () => {
  const statements = read(
    "components/finance/reports/reporting-ledger-report-client.tsx",
  );
  const statementPresentation = read("lib/finance-statement-presentation.ts");
  const daybook = read("components/finance/accounting/daybook-report.tsx");

  assert.match(statements, /function ReportSummary/);
  assert.match(statements, /function StatementSection/);
  assert.match(statements, /Statement of financial position/);
  assert.match(statements, /normalSide="debit"/);
  assert.match(statements, /normalSide="credit"/);
  assert.match(statements, /abnormalNormalBalanceMessage/);
  assert.match(statements, /\{money\(row\.amount\)\}/);
  assert.match(statementPresentation, /Credit balance requires reconciliation/);
  assert.match(statementPresentation, /Debit balance requires reconciliation/);
  assert.doesNotMatch(statementPresentation, /Customer Deposits/);
  assert.match(
    statements,
    /title="Equity"[\s\S]*supplementalRows=\{\[[\s\S]*label: "Current earnings"[\s\S]*totalLabel="Total equity"/,
  );
  assert.match(statements, /total=\{report\.total_equity\}/);
  assert.match(statements, /money\(report\.total_liabilities_and_equity\)/);
  assert.match(statements, /Total liabilities and equity/);
  assert.match(statements, /aria-label="Trial balance reconciliation"/);
  assert.match(
    statements,
    /Opening position, period movement, and closing position/,
  );
  assert.match(statements, /ariaLabel="Party balance summary"/);
  assert.match(statements, /ariaLabel="Custody reconciliation summary"/);
  assert.match(statements, /ariaLabel="Cash flow summary"/);
  assert.match(statements, /variant: "flat" as const/);
  assert.match(statements, /formatDate\(report\.as_of_date \|\| dateTo\)/);

  assert.match(daybook, /formatCurrency/);
  assert.match(daybook, /aria-label="Daybook cash flow summary"/);
  assert.match(daybook, /Audit summary/);
  assert.match(daybook, /lg:hidden/);
  assert.match(daybook, /lg:block/);
  assert.doesNotMatch(daybook, /`Rs\./);
});
