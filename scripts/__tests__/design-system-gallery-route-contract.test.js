const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("the UI gallery is a production-hidden development route outside the dashboard shell", () => {
  const page = read("app/dev/ui-gallery/page.tsx");
  const providers = read("components/providers.tsx");
  const routes = read("lib/development-routes.ts");
  const gallery = read("components/design-system/web-ui-gallery.tsx");
  const responsiveDataView = read(
    "components/patterns/data/responsive-data-view.tsx",
  );

  assert.match(routes, /DEV_UI_GALLERY_PATH\s*=\s*"\/dev\/ui-gallery"/);
  assert.match(
    page,
    /process\.env\.NODE_ENV\s*===\s*"production"\)\s*notFound\(\)/,
  );
  assert.match(page, /WebUiGallery/);
  assert.doesNotMatch(page, /\(dashboard\)|DashboardLayout|useRestaurant/);
  assert.match(providers, /isDevelopmentUiGalleryPath\(pathname\)/);
  assert.match(
    providers,
    /if \(isDevelopmentGallery\)\s*\{\s*return <>\{children\}<\/>&?;?\s*\}/,
  );
  assert.doesNotMatch(
    gallery,
    /fetch\(|axios|useRestaurant|useAuth|useQuery|useMutation/,
  );
  assert.match(gallery, /tableBreakpoint="desktop"/);
  assert.match(gallery, /MetricGrid density="financial"/);
  assert.match(gallery, /MetricGrid density="compact"/);
  assert.match(responsiveDataView, /tableBreakpoint = "desktop"/);
  assert.equal(
    fs.existsSync(
      path.join(root, "app", "(dashboard)", "design-system", "page.tsx"),
    ),
    false,
  );
});
