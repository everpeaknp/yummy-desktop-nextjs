const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Manage is a permission-aware, touch-first directory with an expandable Finance group", () => {
  const manage = read("app/(dashboard)/manage/page.tsx");

  assert.match(manage, /useSidebarItems\(\)/);
  assert.match(manage, /isPathAccessible\(/);
  assert.match(manage, /AppPage width="workspace"/);
  assert.match(manage, /className="hidden lg:flex"/);
  assert.match(manage, /PageSection/);
  assert.match(
    manage,
    /<DataList className="rounded-none border-x-0 bg-transparent shadow-none">/,
  );
  assert.match(manage, /aria-expanded=\{expanded\}/);
  assert.match(manage, /aria-controls="manage-finance-destinations"/);
  assert.match(manage, /items=\{financeItems\}/);
  assert.match(manage, /href: "\/settings"/);
  assert.doesNotMatch(manage, /title: "Help"/);
  assert.doesNotMatch(manage, /href: "\/manage\/roles"/);
  assert.doesNotMatch(manage, /CardContent|<Card/);
  assert.doesNotMatch(manage, /iconColor|iconBg/);
  assert.doesNotMatch(manage, /uppercase|tracking-\[0\.2em\]/);
});

test("Options and add-ons stays available without a subscription gate", () => {
  const manage = read("app/(dashboard)/manage/page.tsx");
  const rolePermissions = read("lib/role-permissions.ts");
  const sidebarItems = read("hooks/use-sidebar-items.ts");
  const modifierLayout = read("app/(dashboard)/menu/modifiers/layout.tsx");

  assert.match(manage, /title: "Options & add-ons"/);
  assert.match(manage, /href: "\/menu\/modifiers"/);
  assert.match(
    rolePermissions,
    /title: "Options & add-ons",\s+href: "\/menu\/modifiers",\s+allowedRoles: ALL_DASHBOARD_ROLES,\s+requiredPermission: "menu\.view"/s,
  );
  assert.match(sidebarItems, /"\/menu\/modifiers": Settings/);
  assert.doesNotMatch(
    sidebarItems,
    /"\/menu\/modifiers": "menu\.modifiers\.enabled"/,
  );
  assert.doesNotMatch(
    modifierLayout,
    /EntitlementGate|menu\.modifiers\.enabled/,
  );
});

test("Categories is discoverable with the other menu configuration destinations", () => {
  const manage = read("app/(dashboard)/manage/page.tsx");
  const rolePermissions = read("lib/role-permissions.ts");
  const sidebarItems = read("hooks/use-sidebar-items.ts");

  const menuIndex = manage.indexOf('title: "Menu"');
  const categoriesIndex = manage.indexOf('title: "Categories"');
  const optionsIndex = manage.indexOf('title: "Options & add-ons"');
  const discountsIndex = manage.indexOf('title: "Discounts"');
  const stationsIndex = manage.indexOf('title: "Stations"');

  assert.ok(menuIndex < categoriesIndex);
  assert.ok(categoriesIndex < optionsIndex);
  assert.ok(optionsIndex < discountsIndex);
  assert.ok(discountsIndex < stationsIndex);
  assert.match(manage, /href: "\/menu\/categories"/);
  assert.match(
    rolePermissions,
    /title: "Categories",\s+href: "\/menu\/categories",\s+allowedRoles: ALL_DASHBOARD_ROLES,\s+requiredPermission: "menu\.view"/s,
  );
  assert.match(sidebarItems, /"\/menu\/categories": LayoutGrid/);
  assert.match(
    sidebarItems,
    /\["\/menu\/items", "\/menu\/categories", "\/menu\/modifiers"\]/,
  );
});
