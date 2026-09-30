const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const dashboard = fs.readFileSync(
  path.join(root, "components/dashboard/mobile-dashboard-home.tsx"),
  "utf8",
);

test("mobile dashboard keeps cancelled but omits completed from the compact metrics", () => {
  assert.match(dashboard, /label="Cancelled"/);
  assert.doesNotMatch(dashboard, /label="Completed"/);
});

test("cancelled orders have a clear cancellation icon", () => {
  assert.match(dashboard, /label="Cancelled"[\s\S]*?icon=\{<XCircle/);
});
