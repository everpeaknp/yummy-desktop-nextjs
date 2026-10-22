const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Cash and Banks is one responsive money-management workspace", () => {
  const page = read("app/(dashboard)/finance/operations/page.tsx");

  assert.match(page, /title="Cash & Banks"/);
  assert.match(page, /Balances, transfers and money-handling configuration/);
  assert.match(page, /aria-label="Financial position"/);
  assert.match(page, /formatCurrency\(value, currency\)/);
  assert.match(page, /formatDateTime\(transfer\.transfer_date\)/);
  assert.match(page, /value=\{activeTab\}/);
  assert.match(page, /onValueChange=\{setActiveTab\}/);
  for (const tab of [
    "accounts",
    "transfers",
    "payment-instruments",
    "cash-drawers",
  ]) {
    assert.match(page, new RegExp(`value="${tab}"`));
  }
  assert.match(page, /> Transfer/);
  assert.match(page, /> Add account/);
  assert.match(page, /aria-label="Refresh balances"/);
  assert.doesNotMatch(page, /Settings2|> Manage</);
  assert.doesNotMatch(page, /`Rs\.|new Intl\.NumberFormat/);
});

test("Cash drawer controls and entity actions keep their existing behavior", () => {
  const drawers = read("components/finance/cash-drawer-config-panel.tsx");

  assert.match(
    drawers,
    /Configure tills, cashier assignment and closing rules/,
  );
  assert.match(drawers, /aria-label="Toggle drawer controls"/);
  assert.match(drawers, /handleDrawerControlsToggle/);
  assert.match(drawers, /handleDrawerDeactivate/);
  assert.match(drawers, /handleAssignCashier/);
  assert.match(drawers, /handleRemoveDrawerAssignment/);
  assert.match(drawers, /DropdownMenu/);
  assert.match(drawers, /Deactivate drawer/);
  assert.match(drawers, /editingAssignmentKey/);
  assert.match(drawers, /Assign cashier/);
  assert.match(drawers, /formatCurrency\(drawer\.standard_float, currency\)/);
  assert.match(drawers, /drawer\.opening_variance_tolerance,[\s\S]*currency/);
  assert.match(drawers, /drawer\.closing_variance_tolerance,[\s\S]*currency/);
  assert.match(drawers, /lg:grid-cols-2/);
  assert.doesNotMatch(drawers, />\s*Drawer Configuration\s*</);
});

test("Payment methods use settings-style rows without changing instrument APIs", () => {
  const instruments = read("components/finance/payment-instruments-panel.tsx");

  assert.match(instruments, /Payment methods/);
  assert.match(instruments, /divide-y divide-border/);
  assert.match(instruments, /AccountingApis\.paymentInstruments/);
  assert.match(instruments, /AccountingApis\.createPaymentInstrument/);
  assert.match(instruments, /AccountingApis\.updatePaymentInstrument/);
  assert.match(instruments, /finance\.payment_instruments\.manage/);
});
