const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("drawer operations remains distinct and uses product money and date formatting", () => {
  const page = read("app/(dashboard)/cash-drawers/page.tsx");
  const panel = read("components/day-close/drawer-session-panel.tsx");

  assert.match(page, /<DrawerSessionPanel/);
  assert.match(page, /title="Active drawer"/);
  assert.match(page, /finance\/operations\?tab=cash-drawers/);
  assert.match(page, /const formatMoney = formatCurrency/);
  assert.match(page, /formatDateTime\(session\.opened_at\)/);
  assert.match(page, /formatDate\(session\.business_date\)/);
  assert.doesNotMatch(page, /`Rs\./);

  for (const label of [
    "Opening",
    "Suggested opening",
    "Counted opening",
    "Movement",
    "Cash sales",
    "Refunds",
    "Expenses",
    "Drops / transfers",
    "Closing",
    "Expected cash",
    "Counted cash",
  ]) {
    assert.match(panel, new RegExp(label.replace("/", "\\/")));
  }
  assert.match(panel, /function DrawerValueSection/);
  assert.match(panel, /formatDate\(effectiveBusinessDate\)/);
  assert.doesNotMatch(panel, /md:grid-cols-6/);
});

test("cash drawers removes nested operation cards in favour of three flat page sections", () => {
  const page = read("app/(dashboard)/cash-drawers/page.tsx");
  const panel = read("components/day-close/drawer-session-panel.tsx");

  assert.match(page, /aria-label="Current drawer cash"/);
  assert.match(page, /presentation="flat"/);
  assert.match(page, /<DrawerHistoryCard/);
  assert.doesNotMatch(page, /<Card/);
  assert.doesNotMatch(page, /CardHeader|CardContent/);

  assert.match(panel, /presentation\?: "surface" \| "flat"/);
  assert.match(panel, /presentation === "surface"/);
  assert.doesNotMatch(panel, /<Card|CardHeader|CardContent/);
  assert.match(panel, /<section/);
  assert.match(
    panel,
    /className="space-y-4 rounded-xl border border-border bg-background p-4"/,
  );
  assert.match(panel, /Retained carry-forward/);
  assert.match(panel, /mt-2 flex justify-end border-t/);
});

test("cash drawer configuration stays in the page header and drawer count copy is pluralized", () => {
  const page = read("app/(dashboard)/cash-drawers/page.tsx");
  const header = read("components/layout/header.tsx");

  assert.match(
    page,
    /variant="outline" size="sm" className="gap-2"[\s\S]*Configure drawers/,
  );
  assert.doesNotMatch(page, /aria-label="Configure drawers"/);
  assert.match(
    page,
    /function activeDrawerCountLabel\(count: number\)[\s\S]*count === 1 \? "drawer" : "drawers"/,
  );
  assert.match(
    page,
    /activeDrawerCountLabel\(drawerSummary\.activeSessionCount\)/,
  );
  assert.match(
    header,
    /pathname === "\/cash-drawers"[\s\S]*aria-label="Configure drawers"/,
  );
});

test("drawer history is a compact register with a desktop column layout", () => {
  const page = read("app/(dashboard)/cash-drawers/page.tsx");

  assert.match(page, /<section className="space-y-3 border-t/);
  assert.match(page, /Drawer history/);
  assert.match(page, /rounded-xl border border-border bg-background/);
  assert.match(
    page,
    /lg:grid-cols-\[150px_minmax\(160px,1fr\)_150px_120px_120px_auto\]/,
  );
  for (const heading of [
    "Drawer",
    "Date",
    "Cashier",
    "Opening",
    "Closing",
    "Status / actions",
  ]) {
    assert.match(page, new RegExp(`>${heading}<`));
  }
  assert.match(page, /Correct \/ Reopen/);
  assert.match(page, /setSelectedSession\(session\)/);
});

test("cash and banks tabs and cashier actions remain readable and state-aware", () => {
  const operations = read("app/(dashboard)/finance/operations/page.tsx");
  const drawerConfig = read("components/finance/cash-drawer-config-panel.tsx");

  assert.match(operations, /overflow-x-auto overscroll-x-contain/);
  assert.match(operations, /w-max min-w-full/);
  assert.match(operations, /value="cash-drawers"[\s\S]*Cash drawers/);
  assert.match(operations, /min-h-11 shrink-0/);
  assert.match(drawerConfig, /assignments\.length[\s\S]*"Change cashier"/);
  assert.match(drawerConfig, /"Assign cashier"/);
  assert.match(drawerConfig, /Select replacement cashier/);
  assert.doesNotMatch(drawerConfig, /\? "Add cashier"/);
});

test("balance sheet removes only redundant roots and preserves account access", () => {
  const report = read(
    "components/finance/reports/reporting-ledger-report-client.tsx",
  );

  assert.match(report, /rootRow\.parent_id == null/);
  assert.match(
    report,
    /rows\.some\(\(row\) => row\.parent_id === rootRow\.head_id\)/,
  );
  assert.match(report, /onSelectHead\(rootRow\.head_id\)/);
  assert.match(
    report,
    /const visibleRows = redundantRoot \? rows\.slice\(1\) : rows/,
  );
  assert.match(report, /line-clamp-2 block break-words/);
  assert.match(report, /normalSide="debit"/);
  assert.match(report, /label: "Current earnings"/);
  assert.match(report, /total=\{report\.total_equity\}/);
  assert.match(report, /showCompactMobilePeriod/);
});

test("trial balance has disclosure rows on mobile and a full desktop table", () => {
  const report = read(
    "components/finance/reports/reporting-ledger-report-client.tsx",
  );

  assert.match(report, /Trial balance summary/);
  assert.match(report, /const \[expandedGroupIds, setExpandedGroupIds\]/);
  assert.match(report, /const \[expandedDetailIds, setExpandedDetailIds\]/);
  assert.match(report, /const childrenByParent = useMemo/);
  assert.match(report, /const visibleMobileRows = useMemo/);
  assert.match(
    report,
    /const appendBranch = \(row: FinanceReportingTrialBalanceRow\)/,
  );
  assert.match(report, /visibleRows\.push\(row\)/);
  assert.match(
    report,
    /for \(const child of childrenByParent\.get\(row\.head_id\) \?\? \[\]\)/,
  );
  assert.doesNotMatch(
    report,
    /for \(const row of report\.rows\) appendBranch\(row\)/,
  );
  assert.match(
    report,
    /aria-expanded=\{[\s\S]*isGroup \? groupExpanded : detailExpanded[\s\S]*\}/,
  );
  assert.match(report, /Show.*accounting details/);
  assert.match(report, /!isGroup && detailExpanded/);
  assert.match(report, /Period movement/);
  assert.match(report, /money\(row\.opening_debit\)/);
  assert.match(report, /onClick=\{\(\) => onSelectHead\(row\.head_id\)\}/);
  assert.match(report, /Math\.min\(Math\.max\(0, row\.depth\), 3\)/);
  assert.match(report, /hidden overflow-x-auto lg:block/);
  for (const heading of [
    "Opening Dr",
    "Opening Cr",
    "Period Dr",
    "Period Cr",
    "Closing Dr",
    "Closing Cr",
  ]) {
    assert.match(report, new RegExp(heading));
  }
});

test("daybook removes empty breakdown and default transaction metadata", () => {
  const report = read("components/finance/accounting/daybook-report.tsx");
  const client = read("components/finance/accounting/daybook-client.tsx");

  assert.match(report, /Math\.abs\(Number\(value\)\) >= 0\.005/);
  assert.match(report, /\.filter\(\(\[, value\]\)/);
  assert.match(report, /\.join\(" · "\)/);
  assert.doesNotMatch(report, /Covered period:/);
  assert.doesNotMatch(report, /Bank \{amount\(row\.bank\)\}/);
  assert.match(report, /formatDateTime\(start\).*–.*formatDateTime\(end\)/s);

  assert.match(client, /function exceptionalStatus/);
  assert.match(client, /normalized === "recorded"/);
  assert.match(client, /row\.reference\?\.trim\(\) \|\| null/);
  assert.match(client, /sourceLabel\(row\.source_type\)/);
  assert.match(client, /sourceLabel\(row\.clearing_status\)/);
  assert.doesNotMatch(client, /row\.reference \|\| "No reference"/);
});
