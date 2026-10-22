const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Branding is owned by the canonical Business Profile workspace", () => {
  const model = read("lib/settings-navigation.ts");
  const route = read("app/(dashboard)/settings/business-profile/page.tsx");
  const workspace = read("components/settings/business-profile-workspace.tsx");

  assert.match(
    model,
    /id: "business_profile"[\s\S]*?route: "\/settings\/business-profile"/,
  );
  assert.match(model, /"logo"[\s\S]*?"cover"[\s\S]*?"branding"/);
  assert.doesNotMatch(model, /id: "branding"/);
  assert.match(route, /BusinessProfileWorkspace/);
  assert.match(
    workspace,
    /<SettingsDesktopRail activeItemId="business_profile"/,
  );
  assert.match(workspace, /<RestaurantBrandingEditor/);
});

test("logo and cover replacement share one editor and save immediately", () => {
  const profile = read("components/settings/business-profile-workspace.tsx");
  const editor = read("components/settings/restaurant-branding-editor.tsx");

  assert.match(profile, /<RestaurantBrandingEditor/);
  assert.match(editor, /ImageService\.uploadRestaurantImage/);
  assert.match(editor, /RestaurantApis\.update\(restaurantId\)/);
  assert.match(editor, /Change cover/);
  assert.match(editor, /Change logo/);
  assert.match(editor, /Uploading cover image/);
  assert.match(editor, /Uploading restaurant logo/);
  assert.match(editor, /role="alert"/);
});

test("legacy Branding routes redirect and no discovery surface exposes Branding", () => {
  const hub = read("components/settings/settings-hub.tsx");
  const model = read("lib/settings-navigation.ts");
  const search = read("components/layout/global-search.tsx");
  const legacyBranding = read("app/(dashboard)/settings/branding/page.tsx");
  const legacyProfile = read("app/(dashboard)/manage/profile/page.tsx");
  const editor = read("components/settings/restaurant-branding-editor.tsx");

  assert.match(legacyBranding, /redirect\("\/settings\/business-profile"\)/);
  assert.match(legacyProfile, /redirect\("\/settings\/business-profile"\)/);
  assert.match(model, /branding: "business_profile"/);
  assert.doesNotMatch(search, /Branding \(Logo & Cover\)/);
  assert.doesNotMatch(hub, /case "branding"/);
  assert.doesNotMatch(hub, /MenuGalleryDialog/);
  assert.doesNotMatch(hub, /setSelectingFor/);
  assert.doesNotMatch(
    editor,
    /receipt-designer|kot-designer|PrinterManagement/,
  );
});
