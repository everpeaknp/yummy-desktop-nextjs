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
    assert.match(page, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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
