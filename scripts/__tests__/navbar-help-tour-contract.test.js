const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("navbar Help opens the help center with the guided product tour", () => {
  const header = read("components/layout/header.tsx");
  const helpCenter = read("components/onboarding/help-center-dialog.tsx");
  const tour = read("components/onboarding/product-tour.tsx");

  assert.match(header, /data-tour="navbar-help"[\s\S]*onClick=\{\(\) => setHelpOpen\(true\)\}/);
  assert.match(header, /<HelpCenterDialog open=\{helpOpen\} onOpenChange=\{setHelpOpen\}/);
  assert.match(helpCenter, /title: "Product tour"[\s\S]*onClick: \(\) => requestProductTour\(\)/);
  assert.match(tour, /"navbar-help":\s*\{\s*title: "Help"/);
});

test("tour tooltip stays hidden until it has been positioned beside its target", () => {
  const tour = read("components/onboarding/product-tour.tsx");

  assert.match(tour, /id="product-tour-tooltip"\s+style=\{\{ visibility: "hidden" \}\}/);
  assert.match(
    tour,
    /tooltip\.style\.visibility = "hidden";[\s\S]*positionTooltip\(target, tooltip\);[\s\S]*tooltip\.style\.visibility = "visible";/,
  );
});
