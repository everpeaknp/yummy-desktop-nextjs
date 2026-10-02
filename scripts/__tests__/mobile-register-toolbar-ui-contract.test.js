const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("shared management toolbar and FAB own the mobile register geometry", () => {
  const toolbar = read(
    "components/patterns/controls/mobile-register-toolbar.tsx",
  );
  const fab = read("components/patterns/actions/mobile-create-fab.tsx");

  assert.match(toolbar, /data-mobile-register-toolbar/);
  assert.match(toolbar, /flex min-w-0 items-center gap-2 lg:hidden/);
  assert.match(toolbar, /min-w-0 flex-1/);

  assert.match(fab, /data-mobile-create-fab/);
  assert.match(fab, /h-14 w-14/);
  assert.match(fab, /right-4/);
  assert.match(fab, /lg:hidden/);
  assert.match(fab, /shouldMobileBottomNavBeVisible/);
  assert.match(
    fab,
    /bottom-\[calc\(5\.5rem\+env\(safe-area-inset-bottom\)\)\]/,
  );
  assert.match(fab, /bottom-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(fab, /aria-label=\{label\}/);
  assert.match(fab, /className="h-20 lg:hidden"/);
});

test("eligible management registers separate finding controls from creation", () => {
  const files = [
    "components/staff/staff-register.tsx",
    "app/(dashboard)/customers/page.tsx",
    "components/manage/suppliers/suppliers-workspace.tsx",
    "app/(dashboard)/menu/categories/page.tsx",
    "app/(dashboard)/menu/modifiers/page.tsx",
    "app/(dashboard)/menu/items/page.tsx",
    "app/(dashboard)/discounts/page.tsx",
    "app/(dashboard)/reservations/page.tsx",
  ];

  for (const file of files) {
    const source = read(file);
    assert.match(source, /<MobileRegisterToolbar/);
    assert.match(source, /<MobileCreateFab/);
  }

  const staff = read(files[0]);
  assert.match(staff, /activeCount=\{activeFilterCount\}/);
  assert.match(staff, /mobileTriggerVariant="icon"/);
  assert.match(
    staff,
    /\{canManageStaff \? \(\s*<MobileCreateFab[\s\S]*label="Add staff"/,
  );

  const customers = read(files[1]);
  const suppliers = read(files[2]);
  const menuItems = read(files[5]);
  const discounts = read(files[6]);
  const reservations = read(files[7]);
  for (const source of [
    customers,
    suppliers,
    menuItems,
    discounts,
    reservations,
  ]) {
    assert.match(source, /mobileTriggerVariant="icon"/);
    assert.match(source, /activeCount=/);
  }

  assert.doesNotMatch(customers, /iconOnly/);
  assert.doesNotMatch(
    reservations,
    /size="icon"[\s\S]{0,180}aria-label="New reservation"/,
  );
});

test("desktop create actions remain and operational Orders stays specialized", () => {
  const staffPage = read("app/(dashboard)/staff/page.tsx");
  const staffRegister = read("components/staff/staff-register.tsx");
  const categories = read("app/(dashboard)/menu/categories/page.tsx");
  const modifiers = read("app/(dashboard)/menu/modifiers/page.tsx");
  const items = read("app/(dashboard)/menu/items/page.tsx");
  const discounts = read("app/(dashboard)/discounts/page.tsx");
  const reservations = read("app/(dashboard)/reservations/page.tsx");
  const orders = read("components/orders/orders-floating-new-button.tsx");

  assert.match(staffPage, /<PageHeader/);
  assert.match(
    staffRegister,
    /<FilterBar[\s\S]*className="hidden lg:block"[\s\S]*Add staff/,
  );
  assert.match(categories, /<PageHeader[\s\S]*Add category/);
  assert.match(modifiers, /<PageHeader[\s\S]*Add option group/);
  assert.match(items, /<PageHeader[\s\S]*Add Item/);
  assert.match(discounts, /<PageHeader[\s\S]*New discount/);
  assert.match(reservations, /<PageHeader[\s\S]*New reservation/);
  assert.match(orders, /<AdaptiveFloatingAction/);
  assert.doesNotMatch(orders, /MobileCreateFab/);
});

test("screens without meaningful filters do not invent them", () => {
  const categories = read("app/(dashboard)/menu/categories/page.tsx");
  const modifiers = read("app/(dashboard)/menu/modifiers/page.tsx");

  assert.match(categories, /<MobileRegisterToolbar[\s\S]*search=\{/);
  assert.doesNotMatch(categories, /mobileTriggerVariant="icon"/);
  assert.match(modifiers, /<MobileRegisterToolbar[\s\S]*search=\{/);
  assert.doesNotMatch(modifiers, /mobileTriggerVariant="icon"/);
});
