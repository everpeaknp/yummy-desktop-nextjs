const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const analytics = fs.readFileSync(
  path.join(root, "app/(dashboard)/analytics/page.tsx"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(root, "docs/WEB_UI_SYSTEM_MIGRATION.md"),
  "utf8",
);
const revenueChart = fs.readFileSync(
  path.join(root, "components/analytics/revenue-chart.tsx"),
  "utf8",
);
const categoryPie = fs.readFileSync(
  path.join(root, "components/analytics/category-pie.tsx"),
  "utf8",
);

test("analytics uses the report-page hierarchy without changing data access", () => {
  assert.match(analytics, /<AppPage width="report" density="compact"/);
  assert.match(analytics, /<DateRangeDropdown/);
  assert.match(analytics, /titleClassName="md:hidden lg:block"/);
  assert.match(analytics, /<FilterBar/);
  assert.match(analytics, /mobileMode="scroll"/);
  assert.match(
    analytics,
    /<h3 className="text-base font-semibold">Snapshot<\/h3>/,
  );
  assert.match(analytics, /label="Refunds"/);
  assert.match(analytics, /label="Operating result"/);
  assert.match(analytics, /className="col-span-2 sm:col-span-1"/);
  assert.match(analytics, /title="Period flow"/);
  assert.match(analytics, /title="Financial position"/);
  assert.match(analytics, /label: "Non-chargeable"/);
  assert.doesNotMatch(analytics, /<SnapshotCard/);
  assert.doesNotMatch(analytics, /Today.s Snapshot/);
  assert.doesNotMatch(analytics, /Rs\.?/);
  assert.match(analytics, /formatCurrency\(Number\(value \|\| 0\)\)/);
  assert.match(analytics, /formatCompactCurrency/);
  assert.match(
    analytics,
    /favorableWhen=\{metric === "expense" \? "down" : "up"\}/,
  );
  assert.match(analytics, /useAnalyticsViewAccess/);
  assert.match(analytics, /AnalyticsApis\.dashboard/);
  assert.match(analytics, /AnalyticsApis\.financeSummary/);
  assert.match(migration, /\| Analytics\s+\| FOUNDATION-COMPLIANT/);
});

test("analytics charts use the configured product currency presentation", () => {
  for (const source of [analytics, revenueChart, categoryPie]) {
    assert.doesNotMatch(source, /Rs\.?/);
  }
  assert.match(revenueChart, /formatCompactCurrency/);
  assert.match(revenueChart, /formatCurrency\(value\)/);
  assert.match(categoryPie, /formatCurrency\(value\)/);
});
