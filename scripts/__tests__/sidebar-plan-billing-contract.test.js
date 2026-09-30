const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("sidebar keeps plan info separate from the spacious billing destination", () => {
  const sidebar = read("components/layout/sidebar.tsx");

  assert.match(
    sidebar,
    /href="\/premium"[\s\S]*aria-label="Open billing and subscription"[\s\S]*className="flex min-h-11 w-full items-center justify-between[\s\S]*<CreditCard[\s\S]*Billing &amp; subscription[\s\S]*<ChevronRight/,
  );
  assert.match(sidebar, /<span className="inline-flex items-center gap-0\.5 rounded-full[\s\S]*\{planDisplayName\}/);
});
