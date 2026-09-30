const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Settings owns the canonical hub and the legacy route preserves queries", () => {
  const page = read("app/(dashboard)/settings/page.tsx");
  const alias = read("app/(dashboard)/manage/additional-settings/page.tsx");

  assert.match(page, /SettingsHub/);
  assert.doesNotMatch(page, /redirect\(/);
  assert.match(
    alias,
    /redirect\(suffix \? `\/settings\?\$\{suffix\}` : "\/settings"\)/,
  );
  assert.match(alias, /URLSearchParams/);
  assert.doesNotMatch(alias, /SettingsHub/);
});

test("the centralized model owns titles, routes, access and mobile return targets", () => {
  const model = read("lib/settings-navigation.ts");

  for (const field of [
    "title",
    "description",
    "category",
    "route",
    "permission",
    "entitlement",
    "searchTerms",
    "mobileBackTarget",
    "availabilityState",
  ]) {
    assert.match(model, new RegExp(`${field}:`));
  }

  for (const category of [
    "Business",
    "Finance & payments",
    "People & access",
    "Hardware & documents",
    "Notifications",
    "Administration",
    "Billing",
    "Personal",
  ]) {
    assert.match(model, new RegExp(`title: "${category.replace("&", "&")}"`));
  }

  assert.match(model, /id: "language"[\s\S]*?availabilityState: "hidden"/);
  assert.match(
    model,
    /id: "gallery_management"[\s\S]*?availabilityState: "hidden"/,
  );
  assert.match(model, /id: "auto_backup"[\s\S]*?availabilityState: "hidden"/);
  assert.match(
    model,
    /id: "business_profile"[\s\S]*?route: "\/settings\/business-profile"/,
  );
  assert.doesNotMatch(model, /id: "branding"/);
  assert.match(
    model,
    /id: "finance_setup"[\s\S]*?route: "\/settings\/finance"/,
  );
  assert.match(
    model,
    /id: "tax_configuration"[\s\S]*?route: "\/settings\/taxes"/,
  );
  assert.match(
    model,
    /id: "payment_integrations"[\s\S]*?route: "\/settings\/payment-integrations"/,
  );
  assert.match(model, /id: "roles"[\s\S]*?route: "\/settings\/roles"/);
  assert.match(
    model,
    /id: "admin_management"[\s\S]*?route: "\/settings\/administrators"/,
  );
  assert.match(
    model,
    /id: "printer_management"[\s\S]*?route: "\/settings\/printers"/,
  );
  assert.match(
    model,
    /id: "receipt_designer"[\s\S]*?route: "\/settings\/receipt-designer"/,
  );
  assert.match(
    model,
    /id: "kot_designer"[\s\S]*?route: "\/settings\/kot-designer"/,
  );
  assert.match(model, /getSettingsRouteOwnership/);
});

test("the Settings hub uses grouped mobile lists and a desktop local-navigation workspace", () => {
  const hub = read("components/settings/settings-hub.tsx");

  assert.match(hub, /<AppPage width="workspace"/);
  assert.match(hub, /<SearchField/);
  assert.match(hub, /<DataList/);
  assert.match(hub, /<ListRow/);
  assert.match(hub, /<EmptyState/);
  assert.match(hub, /aria-label="Settings categories"/);
  assert.match(hub, /sticky top-24/);
  assert.match(hub, /grid-cols-\[272px_minmax\(0,1fr\)\]/);
  assert.match(hub, /hasPermission\(user, item.permission\)/);
  assert.match(hub, /isSubscriptionEntitlementEnabled/);
  assert.match(hub, /open=\{!isDesktop && Boolean\(selectedItem\)\}/);
});

test("mobile title and back ownership come from the Settings model", () => {
  const mobileRoutes = read("lib/mobile-module-navigation.ts");
  const header = read("components/layout/header.tsx");

  assert.match(mobileRoutes, /getSettingsRouteOwnership/);
  assert.match(mobileRoutes, /settingsOwner\.mobileBackTarget/);
  assert.doesNotMatch(mobileRoutes, /\["\/manage\/roles", "Roles"/);
  assert.doesNotMatch(mobileRoutes, /\["\/manage\/taxes", "Taxes/);
  assert.match(header, /getSettingsRouteOwnership/);
  assert.match(header, /router\.push\(settingsOwner\.mobileBackTarget\)/);
  assert.doesNotMatch(header, /function mobileAppBarTitle/);
});

test("global search suppresses legacy Settings definitions and consumes the model", () => {
  const search = read("components/layout/global-search.tsx");

  assert.match(search, /SETTINGS_NAVIGATION_ITEMS\.forEach/);
  assert.match(search, /item\.availabilityState !== "available"/);
  assert.match(search, /hasPermission\(user, item.permission\)/);
  assert.match(search, /item\.section\.startsWith\("Settings \/"\)/);
});

test("Manage remains the parent of the canonical Settings hub", () => {
  const manage = read("app/(dashboard)/manage/page.tsx");
  const mobileRoutes = read("lib/mobile-module-navigation.ts");

  assert.match(manage, /href: "\/settings"/);
  assert.match(
    mobileRoutes,
    /\["\/settings", "Settings", "secondary", "\/manage"\]/,
  );
  assert.match(mobileRoutes, /\["\/manage", "Manage", "top-level"\]/);
});
