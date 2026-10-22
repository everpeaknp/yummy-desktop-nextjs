const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("mobile promo carousel appears after the summary cards and before quick actions", () => {
  const dashboard = read("components/dashboard/mobile-dashboard-home.tsx");
  const cancelledMetric = dashboard.indexOf('label="Cancelled"');
  const carousel = dashboard.indexOf("<DashboardPromoCarousel");
  const quickActions = dashboard.indexOf("<SectionTitle>Quick actions</SectionTitle>");

  assert.ok(cancelledMetric >= 0);
  assert.ok(carousel > cancelledMetric);
  assert.ok(quickActions > carousel);
  assert.match(dashboard, /<main className="w-full min-w-0 space-y-6 pb-24 md:hidden">/);
});

test("mobile promo carousel is platform-managed, auto-advances, and exposes slide controls", () => {
  const carousel = read("components/dashboard/dashboard-promo-carousel.tsx");

  assert.doesNotMatch(carousel, /\/mobile-promos\//, "Promotions must not be hard-coded in the client.");
  assert.match(carousel, /apiClient\.get[\s\S]*?\/dashboard\/banners/);
  assert.match(carousel, /mobile_image_url/);
  assert.match(carousel, /desktop_image_url/);
  assert.match(carousel, /action_type/);
  assert.match(carousel, /router\.push\(actionValue\)/, "Internal banner destinations should use client navigation.");
  assert.match(carousel, /window\.open\(actionValue, "_blank", "noopener,noreferrer"\)/, "External links opened in a new tab must be isolated.");
  assert.match(carousel, /variant === "desktop"/);
  assert.match(carousel, /setBanners\(data\.data \|\| \[\]\)/);
  assert.match(carousel, /setBanners\(\[\]\)/, "A failed banner request must not revive an old local campaign.");
  assert.match(carousel, /setInterval\(/);
  assert.match(carousel, /aria-label=\{`Show promotional banner/);
  assert.match(carousel, /h-40 rounded-2xl xl:h-44/);
  assert.match(carousel, /aspect-\[3\.2\/1\]/, "Mobile banner frame should grow with its available width");
  assert.match(carousel, /w-full min-w-0/, "The carousel should fit its mobile container");
  assert.match(carousel, /max-h-44 min-h-28/, "The banner should stay within a mobile-friendly height range");
});

test("desktop promo carousel sits between the KPI cards and sales dashboard", () => {
  const dashboard = read("components/dashboard/figma-executive-dashboard.tsx");
  const metrics = dashboard.indexOf('aria-label="Current shift"');
  const carousel = dashboard.indexOf("<DashboardPromoCarousel");
  const salesDashboard = dashboard.indexOf('className="grid items-start gap-5');

  assert.ok(metrics >= 0);
  assert.ok(carousel > metrics);
  assert.ok(salesDashboard > carousel);
  assert.match(dashboard.slice(carousel, salesDashboard), /variant="desktop"/);
});
