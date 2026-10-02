const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Staff navigation exposes every section and keeps the active mobile tab visible", () => {
  const shell = read("components/staff/staff-detail-shell.tsx");
  const tabs = read("components/patterns/navigation/page-tabs.tsx");

  for (const section of [
    "Overview",
    "Attendance",
    "Financials",
    "Performance",
    "Employment",
    "Access",
    "Activity",
  ]) {
    assert.match(shell, new RegExp(`label: "${section}"`));
  }
  assert.match(shell, /mobileMode="scroll"/);
  assert.match(shell, /sticky top-24 hidden self-start lg:block/);
  assert.match(tabs, /scrollContainerRef/);
  assert.match(tabs, /scrollIntoView/);
  assert.match(tabs, /inline: "nearest"/);
});

test("Staff unavailable states are consolidated rather than repeated", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const overview = read("components/staff/staff-overview-section.tsx");

  assert.match(overview, /Today&apos;s attendance is unavailable/);
  assert.match(
    overview,
    /Attendance summary is unavailable for your access level/,
  );
  assert.doesNotMatch(detail, /workspaceWarnings/);
  assert.doesNotMatch(detail, /title="Attendance unavailable"/);
  assert.match(detail, /title="No activity yet"/);
  assert.match(detail, /className="min-h-0 py-6"/);
});

test("Staff Financials becomes a desktop workspace and keeps operations beside their data", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const salary = read("components/staff/staff-salary-card.tsx");
  const credit = read("components/staff/staff-credit-card.tsx");

  assert.match(
    detail,
    /lg:grid-cols-\[minmax\(0,1\.2fr\)_minmax\(320px,\.8fr\)\]/,
  );
  assert.match(detail, /lg:sticky lg:top-24/);
  assert.match(salary, /Pay salary[\s\S]*Deduct/);
  assert.match(
    credit,
    /Give advance[\s\S]*Take repayment[\s\S]*Advance history/,
  );
  assert.match(credit, /balance\.balance > 0/);
});
