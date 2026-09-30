const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("normal day close is a simplified financial flow", () => {
  const flow = read("components/day-close/day-close-flow.tsx");
  const detail = read("components/day-close/day-close-confirmed-detail.tsx");
  const financial = read(
    "components/day-close/day-close-financial-details.tsx",
  );
  const source = `${flow}\n${detail}\n${financial}`;

  for (const token of [
    "Financial summary",
    "Sales",
    "Payments collected",
    "Credit sales",
    "Refunds",
    "Expenses",
    "Cash reconciliation",
    "View financial details",
    "View in Analytics",
  ]) {
    assert.match(source, new RegExp(token));
  }

  for (const analyticsContent of [
    "Most sold items",
    "Highest item subtotal",
    "Sales by category",
    "Sales by table",
    "Hourly activity",
    "Customer rankings",
    "Supplier rankings",
  ]) {
    assert.doesNotMatch(source, new RegExp(analyticsContent, "i"));
  }
  assert.doesNotMatch(source, /journal count|suspense amount|trial balance/i);
});

test("v1 close detail is concise while legacy snapshots keep compatibility", () => {
  const history = read("components/analytics/day-close-history.tsx");

  assert.match(history, /isVersionedClose/);
  assert.match(history, /<DayCloseConfirmedDetail/);
  assert.match(history, /Legacy close record/);
  assert.match(history, /<DayCloseSnapshotPanel/);
  assert.doesNotMatch(history, /DayCloseEvidenceView/);
});

test("rich evidence UI is retired without removing the evidence schema", () => {
  const flow = read("components/day-close/day-close-flow.tsx");
  const types = read("types/day-close.ts");

  assert.doesNotMatch(flow, /DayCloseEvidence(View|Dialog)/);
  assert.match(types, /day-close\.evidence\.v1/);
  assert.equal(
    fs.existsSync(
      path.join(root, "components/day-close/day-close-evidence-view.tsx"),
    ),
    false,
  );
});

test("analytics and accounting deep links have one route owner", () => {
  const navigation = read("lib/day-close-navigation.ts");
  const analytics = read("app/(dashboard)/analytics/page.tsx");

  assert.match(navigation, /getAnalyticsUrlForDayClose/);
  assert.match(navigation, /getAccountingReviewUrlForDayClose/);
  assert.match(analytics, /day_close_id/);
  assert.match(analytics, /setSelectedDayCloseSession\(linkedSession\)/);
});
