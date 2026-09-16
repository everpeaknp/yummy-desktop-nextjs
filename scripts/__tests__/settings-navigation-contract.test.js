const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Settings is a real, scoped hub and not a redirect", () => {
  const page = read("app/(dashboard)/settings/page.tsx");
  const workspace = read("app/(dashboard)/manage/additional-settings/page.tsx");

  assert.doesNotMatch(page, /redirect\(/);
  assert.match(page, /AdditionalSettingsPage/);
  assert.match(workspace, /export default function AdditionalSettingsPage/);
  assert.match(workspace, /title: "Personal"/);
  assert.match(workspace, /title: "Business"/);
  assert.match(workspace, /title: "Hardware & documents"/);
  assert.match(workspace, /title: "Notifications"/);
  assert.match(workspace, /title: "People & access"/);
  assert.match(workspace, /title: "Finance & compliance"/);
  assert.match(workspace, /title: "Administration & data"/);
  assert.match(workspace, /title: "Business profile"/);
  assert.match(workspace, /href: "\/finance\/setup"/);
  assert.match(workspace, /href: "\/manage\/taxes"/);
  assert.match(workspace, /href: "\/premium"/);
  assert.match(workspace, /legacySettingItems\.push_alerts/);
  assert.match(workspace, /legacySettingItems\.switch_restaurant/);
  assert.doesNotMatch(workspace, /legacySettingItems\.tax_toggle/);
  assert.doesNotMatch(workspace, /legacySettingItems\.logout/);
});

test("desktop navigation exposes Settings, never a Manage destination", () => {
  const sidebarItems = read("hooks/use-sidebar-items.ts");
  const rolePermissions = read("lib/role-permissions.ts");

  assert.match(rolePermissions, /title: "Settings",\s*href: "\/settings"/);
  assert.doesNotMatch(rolePermissions, /title: "Manage",\s*href: "\/manage"/);
  assert.match(sidebarItems, /else if \(item\.href === "\/settings"\)/);
  assert.doesNotMatch(
    sidebarItems,
    /getGroup\("settings", "Settings", Settings, "\/manage"\)/,
  );
});

test("Manage stays touch-first while settings and administration move behind it", () => {
  const manage = read("app/(dashboard)/manage/page.tsx");
  const mobileRoutes = read("lib/mobile-module-navigation.ts");

  assert.match(manage, /href: "\/settings"/);
  assert.doesNotMatch(manage, /href: "\/manage\/roles"/);
  assert.doesNotMatch(manage, /href: "\/manage\/audit-logs"/);
  assert.doesNotMatch(manage, /href: "\/manage\/taxes"/);
  assert.doesNotMatch(manage, /title: "Help"/);
  assert.match(manage, /window\.matchMedia\("\(min-width: 1024px\)"\)/);
  assert.match(
    manage,
    /router\.replace\(firstWorkspace\?\.href \?\? "\/dashboard"\)/,
  );
  assert.match(
    mobileRoutes,
    /\["\/settings", "Settings", "secondary", "\/manage"\]/,
  );
  assert.match(mobileRoutes, /\["\/manage", "Manage", "top-level"\]/);
});
