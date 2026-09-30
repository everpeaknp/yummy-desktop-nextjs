const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Staff Overview owns the employee-now hierarchy", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const overview = read("components/staff/staff-overview-section.tsx");

  assert.match(detail, /<StaffOverviewSection/);
  assert.match(overview, /title="Today"/);
  assert.match(overview, /title="This period"/);
  assert.match(overview, /title="Employment"/);
  assert.match(overview, /needsAttention \? \(/);
  assert.doesNotMatch(overview, /Recent attendance/);
  assert.doesNotMatch(overview, /<Card|rounded-2xl/);
});

test("Staff Overview uses shared rows and preserves unknown states", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const overview = read("components/staff/staff-overview-section.tsx");

  assert.match(
    overview,
    /<DataList className="rounded-none border-x-0 bg-transparent">/,
  );
  assert.match(overview, /<ListRow/);
  assert.match(detail, /\.\.\.\(attendanceAvailable/);
  assert.match(detail, /\.\.\.\(scheduleAvailable/);
  assert.match(detail, /todayUnavailable=\{!attendanceAvailable\}/);
  assert.match(overview, /Today&apos;s attendance is unavailable/);
  assert.match(detail, /No attendance record available/);
  assert.match(detail, /No schedule assigned/);
  assert.match(detail, /No leave requests/);
  assert.match(detail, /No issues/);
});

test("Overview groups keep singular responsibilities", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const overviewStart = detail.indexOf("<StaffOverviewSection");
  const overviewEnd = detail.indexOf(
    '{activeSection === "attendance"',
    overviewStart,
  );
  const usage = detail.slice(overviewStart, overviewEnd);

  assert.match(usage, /label: "Attendance"/);
  assert.match(usage, /label: "Schedule"/);
  assert.match(usage, /label: "Leave"/);
  assert.match(usage, /label: "Issues"/);
  assert.match(usage, /label: "Regular time"/);
  assert.match(usage, /label: "Overtime"/);
  assert.match(usage, /label: "Exceptions"/);
  assert.match(usage, /label: "Role"/);
  assert.match(usage, /label: "Compensation"/);
  assert.doesNotMatch(usage, /Staff reference|Staff #|Recent attendance/);
  assert.doesNotMatch(usage, /value:[\s\S]{0,80}"Unavailable"/);
  assert.doesNotMatch(detail, /workspaceWarnings/);
});

test("Staff identity is compact and avoids technical metadata", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const shell = read("components/staff/staff-detail-shell.tsx");

  assert.match(detail, /reference=\{staff\.email \|\| null\}/);
  assert.match(shell, /<PageHeader/);
  assert.match(shell, />Edit staff</);
  assert.doesNotMatch(shell, /Staff ID|access roles/);
});

test("Staff mobile navigation remains query-backed and touch friendly", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const shell = read("components/staff/staff-detail-shell.tsx");

  assert.match(shell, /<PageTabs/);
  assert.match(shell, /mobileMode="scroll"/);
  assert.doesNotMatch(shell, /More staff details|<SheetContent/);
  assert.match(detail, /nextParams\.set\("tab", section\)/);
  assert.match(detail, /searchParams\.get\("tab"\)/);
  assert.doesNotMatch(detail, /Tabs(?:List|Trigger|Content)/);
});
