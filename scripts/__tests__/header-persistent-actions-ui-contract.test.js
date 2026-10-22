const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const header = fs.readFileSync(
  path.resolve(__dirname, "../../components/layout/header.tsx"),
  "utf8",
);

test("Plans and notifications stay in the header on every dashboard route", () => {
  const start = header.indexOf("{/* Subscription catalog shortcut */}");
  const end = header.indexOf('<Button\n            type="button"', start);
  const actions = header.slice(start, end);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(actions, /isPathAccessible\("\/premium", user\)[\s\S]*?<Link href="\/premium">/);
  assert.match(actions, /<NotificationBell \/>/);
  assert.match(actions, /<NotificationPanel \/>/);
  assert.doesNotMatch(actions, /isDashboard\s*\?/);
});
