const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("the Profile destination edits the signed-in user's personal account", () => {
  const profilePage = read("app/(dashboard)/manage/profile/page.tsx");

  assert.match(profilePage, /AuthApis\.meProfile/);
  assert.match(profilePage, /AuthApis\.uploadProfilePicture/);
  assert.match(profilePage, /AuthApis\.changePassword/);
  assert.match(profilePage, /Full name/i);
  assert.match(profilePage, /Email/i);
  assert.doesNotMatch(profilePage, /RestaurantApis\.getById/);
});

test("the business profile remains accessible as a Manage destination", () => {
  const businessProfile = read(
    "app/(dashboard)/manage/business-profile/page.tsx",
  );
  const managePage = read("app/(dashboard)/manage/page.tsx");
  const mobileRoutes = read("lib/mobile-module-navigation.ts");

  assert.match(businessProfile, /RestaurantApis\.getById/);
  assert.match(managePage, /Business profile/);
  assert.match(managePage, /\/manage\/business-profile/);
  assert.match(mobileRoutes, /"\/manage\/business-profile", "Business profile", "secondary", "\/manage"/);
});

test("mobile Profile navigation is labeled for the signed-in user", () => {
  const mobileNav = read("components/layout/mobile-bottom-nav.tsx");
  const mobileRoutes = read("lib/mobile-module-navigation.ts");

  assert.match(mobileNav, /title: "Profile",\s*href: "\/manage\/profile"/);
  assert.match(mobileRoutes, /"\/manage\/profile", "My profile", "top-level"/);
});

test("profile form actions and mobile page clearance stay aligned", () => {
  const profilePage = read("app/(dashboard)/manage/profile/page.tsx");

  assert.match(profilePage, /density="compact"/);
  assert.match(profilePage, /pb-10 lg:pb-8/);
  assert.doesNotMatch(profilePage, /px-4 py-5/);
  assert.match(profilePage, /id="profile-name"[\s\S]*?Save name/);
  assert.match(profilePage, /min-\[480px\]:flex-row/);
  assert.match(profilePage, /disabled:bg-muted disabled:text-muted-foreground/);
  assert.match(profilePage, /variant="outline"[\s\S]*capitalize/);
  assert.doesNotMatch(profilePage, /justify-between gap-3/);
});

test("profile photo limits match the JPG and PNG helper text", () => {
  const profilePage = read("app/(dashboard)/manage/profile/page.tsx");

  assert.match(profilePage, /accept="image\/jpeg,image\/png,\.jpg,\.jpeg,\.png"/);
  assert.match(profilePage, /Choose a JPG or PNG image/);
  assert.match(profilePage, /text-xs text-muted-foreground">JPG or PNG, up to 5 MB/);
});

test("profile role badges use the same role colors as staff management", () => {
  const profilePage = read("app/(dashboard)/manage/profile/page.tsx");

  assert.match(profilePage, /border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950\/30 dark:text-red-400/);
  assert.match(profilePage, /border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900 dark:bg-blue-950\/30 dark:text-blue-400/);
  assert.match(profilePage, /border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950\/30 dark:text-emerald-400/);
  assert.match(profilePage, /border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-900 dark:bg-orange-950\/30 dark:text-orange-400/);
  assert.match(profilePage, /border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-900 dark:bg-purple-950\/30 dark:text-purple-400/);
  assert.match(profilePage, /border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950\/30 dark:text-indigo-400/);
});

test("every signed-in role can access its own profile without staff-admin permission", () => {
  const permissions = read("lib/role-permissions.ts");
  const routeGuard = permissions.match(
    /export function isRouteAllowed\([\s\S]*?(?=\nexport function isRouteAllowedMulti)/,
  )?.[0];

  assert.match(routeGuard || "", /pathname === "\/manage\/profile"[\s\S]*return true/);
});
