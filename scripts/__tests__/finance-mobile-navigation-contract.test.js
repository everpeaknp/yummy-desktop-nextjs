const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Manage is a global mobile destination and modules remain secondary", () => {
  const layout = read("app/(dashboard)/layout.tsx");
  const bottomNav = read("components/layout/mobile-bottom-nav.tsx");
  const header = read("components/layout/header.tsx");
  const routeResolver = read("lib/mobile-module-navigation.ts");

  assert.match(
    routeResolver,
    /globalMobileNavigationRoutes = \[[\s\S]*?"\/dashboard"[\s\S]*?"\/orders"[\s\S]*?"\/analytics"[\s\S]*?"\/manage\/profile"[\s\S]*?"\/manage"/,
  );
  assert.match(routeResolver, /shouldMobileBottomNavBeVisible/);
  assert.match(routeResolver, /isMobileSecondaryModuleRoute/);
  assert.match(routeResolver, /getMobileRoutePresentation/);
  assert.match(
    layout,
    /isSecondaryMobileModule\s*=\s*isMobileSecondaryModuleRoute\(pathname\)/,
  );
  assert.match(layout, /pb-\[max\(env\(safe-area-inset-bottom\),1rem\)\]/);
  assert.match(layout, /: "pb-24"/);
  assert.doesNotMatch(layout, /FinanceMobileNav/);
  assert.match(
    bottomNav,
    /if \(!shouldMobileBottomNavBeVisible\(pathname\)\) return null/,
  );
  assert.match(bottomNav, /title: "Manage",\s*href: "\/manage"/);
  assert.match(
    bottomNav,
    /gridTemplateColumns: `repeat\(\$\{navigationItems\.length\}/,
  );
  assert.doesNotMatch(bottomNav, /analytics\s*\|\|\s*finance/);
  assert.doesNotMatch(bottomNav, /MoreHorizontal|SheetContent|SheetTrigger/);
  assert.doesNotMatch(bottomNav, /\bMore\b/);
  assert.match(layout, /lg:flex-row/);
  assert.match(bottomNav, /lg:hidden/);
  assert.match(
    read("app/(dashboard)/manage/page.tsx"),
    /const sidebarItems = useSidebarItems\(\)/,
  );
  assert.match(
    read("app/(dashboard)/manage/page.tsx"),
    /aria-controls="manage-finance-destinations"/,
  );
  assert.match(
    header,
    /if \(isMobileSecondaryModuleRoute\(pathname \|\| ""\)\)/,
  );
  assert.match(header, /router\.back\(\)/);
  assert.match(header, /getMobileRoutePresentation\(pathname\)/);
  assert.match(header, /<MobileAppBar/);
});
