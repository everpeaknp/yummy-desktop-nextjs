const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Business Profile uses the responsive Settings workspace", () => {
  const route = read("app/(dashboard)/settings/business-profile/page.tsx");
  const legacyRoute = read("app/(dashboard)/manage/profile/page.tsx");
  const page = read("components/settings/business-profile-workspace.tsx");
  const rail = read("components/settings/settings-desktop-rail.tsx");

  assert.match(route, /BusinessProfileWorkspace/);
  assert.match(legacyRoute, /redirect\("\/settings\/business-profile"\)/);
  assert.match(page, /<AppPage width="workspace"/);
  assert.match(page, /<SettingsDesktopRail activeItemId="business_profile"/);
  assert.match(page, /title="Business profile"/);
  assert.match(rail, /SETTINGS_NAVIGATION_ITEMS/);
  assert.match(rail, /sticky top-24/);
  assert.match(rail, /hasPermission\(user, item.permission\)/);
});

test("Business Profile keeps the existing update, image, location and business-day contracts", () => {
  const page = read("components/settings/business-profile-workspace.tsx");
  const branding = read("components/settings/restaurant-branding-editor.tsx");

  assert.match(page, /RestaurantApis\.getById\(user\.restaurant_id\)/);
  assert.match(page, /RestaurantApis\.update\(user\.restaurant_id\)/);
  assert.match(page, /<RestaurantBrandingEditor/);
  assert.match(branding, /ImageService\.uploadRestaurantImage/);
  assert.match(branding, /RestaurantApis\.update\(restaurantId\)/);
  assert.match(page, /forwardGeocode/);
  assert.match(page, /reverseGeocode/);
  assert.match(page, /business_day_start_time/);
  assert.match(page, /fetchGlobalRestaurant\(true\)/);
});

test("Business Profile is section-led with shared feedback and sticky save actions", () => {
  const page = read("components/settings/business-profile-workspace.tsx");

  assert.match(page, />Identity</);
  assert.match(page, /Location & contact/);
  assert.match(page, /Operations/);
  assert.match(page, /<LoadingState/);
  assert.match(page, /<ErrorState/);
  assert.match(page, /sticky bottom-0/);
  assert.match(page, /Save changes/);
  assert.doesNotMatch(page, /<Card/);
  assert.doesNotMatch(page, /Branding & Media/);
  assert.doesNotMatch(page, /General Information/);
});

test("Currency remains read-only and owned by Finance Setup", () => {
  const page = read("components/settings/business-profile-workspace.tsx");

  assert.match(page, /value=\{restaurant\?\.currency \|\| "NPR"\} disabled/);
  assert.match(page, /Currency is managed by the financial setup/);
  assert.doesNotMatch(page, /currency: event\.target\.value/);
});
