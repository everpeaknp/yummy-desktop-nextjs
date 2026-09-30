const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const displayUtilsPath = path.join(root, "lib/dashboard-display-utils.js");

function displayUtils() {
  assert.ok(fs.existsSync(displayUtilsPath), "dashboard display helpers should exist");
  return require(displayUtilsPath);
}

test("dashboard alert durations stay readable for hours and multi-day ages", () => {
  const { formatDashboardDuration } = displayUtils();
  assert.equal(formatDashboardDuration(2196), "36h 36m");
  assert.equal(formatDashboardDuration(140519), "97d 14h");
});

test("payment instrument labels hide raw unspecified backend names", () => {
  const { formatPaymentInstrumentLabel } = displayUtils();
  assert.equal(formatPaymentInstrumentLabel("card • Unspecified Card"), "Card – Other");
  assert.equal(formatPaymentInstrumentLabel("digital • Unspecified QR"), "QR – Other");
  assert.equal(formatPaymentInstrumentLabel("digital • Nabil"), "QR – Nabil");
});

test("attention codes become readable product labels", () => {
  const { formatAttentionType } = displayUtils();
  assert.equal(formatAttentionType("ORDER_AGING"), "Order aging");
  assert.equal(formatAttentionType("OUTSTANDING_RECEIVABLES"), "Outstanding receivables");
  assert.equal(formatAttentionType("STALE_OPEN_ORDERS"), "Stale open orders");
});

test("desktop lifetime charts default to weekly and state the selected period", () => {
  const page = read("app/(dashboard)/dashboard/page.tsx");
  const component = read("components/dashboard/figma-executive-dashboard.tsx");
  assert.ok(/activeRange === "lifetime"\s*\?\s*"weekly"/.test(page), "Lifetime should default to weekly trends");
  assert.ok(/activeRange === "lifetime" && trends.length > 0/.test(page), "Lifetime data should keep weekly available");
  assert.ok(/periodLabel=/.test(page), "The selected period should be passed to the chart");
  assert.ok(/periodLabel/.test(component), "The chart should display its period");
  assert.ok(/movingAverage/.test(component), "Daily trends should include a moving average");
});

test("dashboard visual hierarchy stays compact and makes empty/live content useful", () => {
  const component = read("components/dashboard/figma-executive-dashboard.tsx");
  assert.ok(/min-h-\[100px\]/.test(component), "KPI cards should be shorter");
  assert.ok(/h-\[224px\]/.test(component), "The chart should use less vertical space");
  assert.ok(/formatDashboardDuration\(ageMinutes\)/.test(component), "Attention ages should be human-readable");
  assert.ok(/formatPaymentInstrumentLabel\(value\(item, \["name"\], "Other"\)\)/.test(component), "Payment names should be cleaned up");
  assert.ok(/showAllStaff \? staff : staff\.slice\(0, 4\)/.test(component), "Staff list should start compact");
  assert.ok(/grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6/.test(component), "Top items should gain width at intermediate breakpoints");
  assert.ok(/New orders will appear here as they are placed/.test(component), "The pipeline empty state should explain what appears here");
  assert.ok(/No collections recorded this shift yet/.test(component), "An empty shift should collapse the zero-value cards");
  assert.ok(/hasShiftCollections/.test(component), "Shift collections should only expand when there is activity");
  assert.ok(/items_summary/.test(component), "Live orders should retain their item summary");
});

test("promo banners preserve their logo and copy without a hard crop", () => {
  const carousel = read("components/dashboard/dashboard-promo-carousel.tsx");
  assert.ok(/object-contain p-1/.test(carousel), "The full banner should remain visible");
  assert.ok(/blur-xl/.test(carousel), "The banner backdrop should fill the wide frame");
  assert.ok(/h-40 rounded-2xl xl:h-44/.test(carousel), "The desktop banner frame should remain compact");
});

test("daily chart rolling average uses a trailing seven-day window", () => {
  const { addTrailingMovingAverage } = displayUtils();
  const points = [1, 2, 3, 4, 5, 6, 7, 8].map((amount) => ({ amount }));
  const result = addTrailingMovingAverage(points, 7);
  assert.equal(result[0].movingAverage, 1);
  assert.equal(result[6].movingAverage, 4);
  assert.equal(result[7].movingAverage, 5);
});
