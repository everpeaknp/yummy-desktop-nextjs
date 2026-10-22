const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

test("operational inventory keeps accounting policy out of ordinary forms", () => {
  const page = read("app/(dashboard)/inventory/page.tsx");

  assert.doesNotMatch(page, /ACCOUNTING_TREATMENT_OPTIONS/);
  assert.doesNotMatch(page, /opening_stock_accounting_treatment/);
  assert.doesNotMatch(page, /Accounting treatment/);
  assert.doesNotMatch(page, /Expense now/);
  assert.doesNotMatch(page, /Stock value/);
});

test("operational inventory exposes permission-gated multi-line consumption", () => {
  assert.ok(
    exists("components/inventory/inventory-consumption-dialog.tsx"),
    "inventory consumption dialog should exist",
  );

  const page = read("app/(dashboard)/inventory/page.tsx");
  const dialog = read("components/inventory/inventory-consumption-dialog.tsx");
  const endpoints = read("lib/api/endpoints.ts");
  const types = read("types/inventory.ts");

  for (const token of [
    "InventoryConsumptionDialog",
    "inventory.consume",
    "inventory.negative_stock.override",
    "Consume",
  ]) {
    assert.match(
      page,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }

  for (const token of [
    "previewConsumption",
    "InventoryApis.consume",
    "idempotency_key",
    "purpose",
    "allow_negative",
    "Add item",
    "Stock consumed",
  ]) {
    assert.match(`${dialog}\n${endpoints}\n${types}`, new RegExp(token));
  }
});

test("inventory uses a responsive stock register without changing its domain workflows", () => {
  const page = read("app/(dashboard)/inventory/page.tsx");
  const activity = read("components/inventory/inventory-activity-panel.tsx");

  assert.match(page, /AppPage width="register"/);
  assert.match(page, /SegmentedControl/);
  assert.match(page, /StatusBadge tone="warning"/);
  assert.match(page, /ErrorState/);
  assert.match(page, /formatMoney\(valuation\?\.total_value \|\| 0\)/);
  assert.match(page, /lg:hidden/);
  assert.match(page, /lg:block/);
  assert.doesNotMatch(page, /MetricCard/);

  assert.match(activity, /SearchField/);
  assert.match(activity, /ListRow/);
  assert.match(activity, /StatusBadge/);
  assert.match(
    activity,
    /hidden overflow-x-auto rounded-xl border border-border lg:block/,
  );
  assert.match(activity, /formatMoney\(Number\(row\.cost\)\)/);
});

test("inventory detail presents linked menu names and a touch-first stock ledger", () => {
  const detail = read("components/inventory/inventory-item-details-sheet.tsx");
  const page = read("app/(dashboard)/inventory/page.tsx");

  assert.match(detail, /function presentActivityReason/);
  assert.match(detail, /menuItems\.find/);
  assert.match(detail, /Unit: \{unit\}/);
  assert.doesNotMatch(detail, /\{stats\.recent\.reason\}/);

  assert.match(page, /function inventoryMovementLabel/);
  assert.match(page, /function inventoryMovementReason/);
  assert.match(page, /function inventoryMovementReference/);
  assert.match(page, /LoadingState label="Loading stock movements"/);
  assert.match(page, /title="No stock movements yet"/);
  assert.match(page, /lg:hidden/);
  assert.match(
    page,
    /hidden overflow-x-auto rounded-xl border border-border lg:block/,
  );
  assert.match(page, /Balance after movement/);
  assert.doesNotMatch(page, /No ledger movements found/);
});
