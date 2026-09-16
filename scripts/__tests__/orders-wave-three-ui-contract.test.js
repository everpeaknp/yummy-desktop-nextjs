const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Wave 3 records the Orders operational family and its protected patterns", () => {
  const migration = read("docs/WEB_UI_SYSTEM_MIGRATION.md");

  assert.match(
    migration,
    /`\/orders`, `\/orders\/history`, `\/orders\/\[id\]`/,
  );
  assert.match(
    migration,
    /Orders, Order History, Order Detail and Quick Bill[\s\S]*APPROVED/,
  );
  assert.match(migration, /mobile New Order control\/animation/);
  assert.match(
    migration,
    /KOT cards remain[\s\S]*protected domain-specific patterns/,
  );
});

test("Orders keeps its domain cards and mobile New Order interaction while using responsive controls", () => {
  const page = read("app/(dashboard)/orders/page.tsx");
  const newOrder = read("components/orders/orders-new-order-sheet.tsx");

  assert.match(page, /<OrderCard order=\{order\}/);
  assert.match(page, /<OrderHistoryCard[\s\S]*order=\{order\}/);
  assert.match(page, /<OrdersNewOrderSheet \/>/);
  assert.match(page, /grid-cols-1 gap-3 sm:grid-cols-2/);
  assert.match(page, /className="shrink-0 lg:hidden"/);
  assert.match(page, /FilterBar className="hidden lg:block"/);
  assert.match(
    page,
    /pb-\[calc\(9rem\+env\(safe-area-inset-bottom\)\)\] lg:pb-10/,
  );
  assert.match(page, /Completed and historical orders for review\./);
  assert.match(newOrder, /orders-new-order-cta fixed/);
  assert.match(newOrder, /new-order-sheet-motion/);
});

test("Orders money, receipt access, and operational detail hierarchy remain intact", () => {
  const activeCard = read("components/orders/order-card.tsx");
  const historyCard = read("components/orders/order-history-card.tsx");
  const detail = read("app/(dashboard)/orders/[id]/page.tsx");
  const quickBill = read("components/orders/pos-system.tsx");
  const customisation = read("components/orders/item-customization-dialog.tsx");

  assert.match(activeCard, /formatCurrency\(order\.grand_total, currency\)/);
  assert.match(historyCard, /formatCurrency\(order\.grand_total, currency\)/);
  assert.doesNotMatch(activeCard, /\|\| "Rs\."/);
  assert.doesNotMatch(historyCard, /\|\| "Rs\."/);
  assert.match(detail, /formatProductCurrency\(amount\)/);
  assert.match(
    detail,
    /const statusConfig = getStatusConfig\(displayOrder\.status\)/,
  );
  assert.match(detail, /\{statusConfig\.label\}/);
  assert.match(detail, /Menu prices\/subtotal are tax-inclusive/);
  assert.match(detail, /subtotal \+\s*Number\(sourceOrder\.service_charge/);
  assert.match(detail, /Tax included/);
  assert.doesNotMatch(detail, /Rs\./);
  assert.match(
    quickBill,
    /formatCurrency\(\s*getItemUnitPrice\(item\),\s*restaurant\?\.currency,?\s*\)/,
  );
  assert.match(
    quickBill,
    /itemCount: Array\.isArray\(items\) \? items\.length : 0/,
  );
  assert.match(quickBill, /\{cat\.name\} \(\{cat\.itemCount\}\)/);
  assert.match(
    quickBill,
    /pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\] lg:pb-8/,
  );
  assert.doesNotMatch(quickBill, /Rs\./);
  assert.doesNotMatch(customisation, /Rs\./);
  assert.match(detail, /href=\{`\/orders\/\$\{orderId\}\/receipt`\}/);
  assert.match(detail, /SalesDocumentDetailSheet/);
  assert.match(detail, /aria-label="More order actions"/);
});

test("POS loads selectable modifier options and lets every cart line carry a note", () => {
  const pos = read("components/orders/pos-system.tsx");
  const customisation = read("components/orders/item-customization-dialog.tsx");

  assert.match(pos, /ModifierApis\.listItemsByGroup\(group\.id\)/);
  assert.match(
    pos,
    /modifiers:\s+optionsResponse\.data\.status === "success"[\s\S]*\? optionsResponse\.data\.data/,
  );
  assert.match(pos, /onCustomizeItem: \(item: CartItem\) => void/);
  assert.match(pos, /\{item\.notes \|\| item\.modifiers\?\.length/);
  assert.match(pos, /: "Add note"/);
  assert.match(pos, /confirmLabel=.*"Save changes"/s);
  assert.match(customisation, /initialModifiers\?: any\[\]/);
  assert.match(customisation, /const EMPTY_MODIFIERS: any\[\] = \[\];/);
  assert.match(customisation, /initialModifiers = EMPTY_MODIFIERS/);
  assert.match(customisation, /initialNotes\?: string/);
  assert.match(
    customisation,
    /onConfirm\(item, flatModifiers, notes\.trim\(\)\)/,
  );
  assert.match(customisation, /modifier\.is_active !== false/);
});
