const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("workforce routes keep operational ownership and mobile navigation", () => {
  const navigation = read("lib/mobile-module-navigation.ts");
  const sidebar = read("hooks/use-sidebar-items.ts");

  assert.match(
    navigation,
    /\["\/workforce", "Workforce", "secondary", "\/manage"\]/,
  );
  assert.match(navigation, /\["\/staff", "Staff", "secondary", "\/manage"\]/);
  assert.match(
    navigation,
    /\["\/attendance", "Attendance", "secondary", "\/workforce"\]/,
  );
  assert.match(navigation, /backFallback: "\/staff"/);
  assert.match(
    sidebar,
    /getGroup\("workforce", "Workforce", Briefcase, "\/workforce"\)/,
  );
});

test("shared Workforce grammar is compact, operational, and reusable", () => {
  const primitive = read("components/workforce/workforce-presentation.tsx");
  const workforce = read("app/(dashboard)/workforce/page.tsx");
  const staff = read("app/(dashboard)/staff/page.tsx");
  const attendance = read("components/attendance/attendance-admin-client.tsx");

  assert.match(primitive, /function WorkforceSection/);
  assert.match(primitive, /function WorkforceMetricStrip/);
  assert.match(primitive, /divider-led summary/);
  assert.match(workforce, /title="Today"/);
  assert.match(workforce, /title="Needs attention"/);
  assert.match(staff, /<StaffRegister/);
  assert.doesNotMatch(staff, /function MetricCard/);
  assert.match(attendance, /WorkforceMetricStrip/);
  assert.match(attendance, /WorkforceSection/);
});

test("Staff and Attendance remain touch-first below lg", () => {
  const staff = read("components/staff/staff-register.tsx");
  const attendance = read("components/attendance/attendance-admin-client.tsx");

  assert.match(staff, /<DataList className="lg:hidden">/);
  assert.match(
    staff,
    /hidden max-w-full overflow-x-auto rounded-2xl border border-border bg-card lg:block/,
  );
  assert.match(staff, /<ListRow/);
  assert.match(staff, /staffStatus\(member\)/);
  assert.doesNotMatch(staff, /DueAmountLabel|net_due/);
  assert.match(attendance, /className="hidden lg:flex"/);
  assert.match(attendance, /<div className="lg:hidden">/);
  assert.match(attendance, /hidden overflow-x-auto rounded-md border lg:block/);
});

test("Staff detail replaces horizontal tabs with responsive query-backed navigation", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const shell = read("components/staff/staff-detail-shell.tsx");

  assert.match(detail, /<StaffIdentityHeader/);
  assert.match(detail, /useMobileAppBarTitle/);
  assert.doesNotMatch(detail, /useMobileAppBarActions|refresh-staff/);
  assert.match(detail, /<StaffMobileSectionNav/);
  assert.match(detail, /<StaffDesktopSectionNav/);
  assert.match(detail, /<StaffSectionHeading section=\{activeSection\}/);
  assert.doesNotMatch(detail, /Tabs(?:List|Trigger|Content)/);
  assert.doesNotMatch(detail, /@\/components\/ui\/tabs/);
  assert.match(shell, /<PageTabs/);
  assert.match(shell, /mobileMode="scroll"/);
  assert.match(shell, /items=\{availableSections\.map/);
  assert.doesNotMatch(shell, /More staff details|<SheetContent/);
  assert.match(shell, /sticky top-24 hidden self-start lg:block/);
  assert.match(shell, /aria-current=\{active \? "page" : undefined\}/);
});

test("Staff detail preserves canonical deep links and the legacy payroll alias", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const shell = read("components/staff/staff-detail-shell.tsx");

  assert.match(shell, /value === "payroll" \? "financials" : value/);
  assert.match(detail, /searchParams\.get\("tab"\)/);
  assert.match(detail, /nextParams\.set\("tab", section\)/);
  assert.match(detail, /router\.replace\(`\?\$\{nextParams\.toString\(\)\}`/);
  for (const section of [
    "overview",
    "attendance",
    "financials",
    "performance",
    "employment",
    "access",
    "activity",
  ]) {
    assert.match(shell, new RegExp(`value: "${section}"`));
  }
});

test("Staff detail sections use compact operational groupings", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const overview = read("components/staff/staff-overview-section.tsx");

  assert.match(detail, /<StaffOverviewSection/);
  assert.match(overview, /title="Today"/);
  assert.match(overview, /title="This period"/);
  assert.match(overview, /title="Employment"/);
  assert.match(overview, /title="Needs attention"/);
  assert.doesNotMatch(overview, /Employment snapshot|Setup state/);
  assert.doesNotMatch(overview, /Recent attendance/);
  assert.match(detail, /No staff-specific schedule\./);
  assert.match(detail, /No leave records\./);
  assert.match(detail, /title="Recent activity"/);
  assert.match(detail, /StaffSalaryCard/);
  assert.match(detail, /StaffCreditCard/);
});

test("Staff detail keeps Financials and Employment as readable staff workspaces", () => {
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");
  const salary = read("components/staff/staff-salary-card.tsx");
  const credit = read("components/staff/staff-credit-card.tsx");

  assert.match(
    salary,
    /<h3 className="text-base font-semibold">Current salary<\/h3>/,
  );
  assert.match(
    credit,
    /<h3 className="text-base font-semibold">Credits &amp; advances<\/h3>/,
  );
  assert.doesNotMatch(salary, /<Card className=/);
  assert.doesNotMatch(credit, /<Card className=/);
  assert.doesNotMatch(salary, />More actions</);
  assert.match(
    salary,
    /Pay salary[\s\S]*Deduct[\s\S]*Financial history[\s\S]*Salary settings/,
  );
  assert.match(salary, /Financial history/);
  assert.match(salary, /label="Salary history"/);
  assert.match(salary, /label="Payments"/);
  assert.match(salary, /label="Adjustments"/);
  assert.match(salary, /Compensation changes/);
  assert.match(
    credit,
    /title="Balance"[\s\S]*Give advance[\s\S]*Take repayment[\s\S]*Advance history/,
  );
  assert.match(credit, /balance.balance > 0/);
  assert.match(
    credit,
    /<DialogContent>[\s\S]*<CashBankAccountSelect[\s\S]*label=\{entryOpen === "advance" \? "Pay from" : "Receive into"\}/,
  );
  assert.match(detail, /title="Compensation"/);
  assert.match(detail, /compensationHistory=\{salaryHistory\}/);
  assert.doesNotMatch(detail, />Compensation history<\/span>/);
  assert.match(detail, /label="Effective from"/);
  assert.match(detail, /CardTitle>Profile<\/CardTitle>/);
  assert.match(
    detail,
    /variant=\{period\.is_current \? "secondary" : "outline"\}/,
  );
  assert.match(detail, /className="self-start whitespace-nowrap"/);
  assert.match(
    detail,
    /className="flex flex-col gap-2 border-b py-3 last:border-b-0/,
  );
  assert.match(detail, /variant="destructive"/);
});

test("attendance keeps authoritative labels and workflow calls", () => {
  const presentation = read("lib/presentation/workforce.ts");
  const attendance = read("components/attendance/attendance-admin-client.tsx");
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");

  assert.match(presentation, /missing_checkout: "Missing clock-out"/);
  assert.match(presentation, /payroll_exported: "Sent to payroll"/);
  assert.match(attendance, /attendanceApi\.approveEntry/);
  assert.match(attendance, /attendanceApi\.correctEntry/);
  assert.match(detail, /attendanceStatusLabel\(entry\.status\)/);
  assert.match(detail, /attendanceApprovalLabel\(entry\.approval_status\)/);
});

test("unavailable attendance is not represented as zero or ready", () => {
  const workforce = read("app/(dashboard)/workforce/page.tsx");
  const detail = read("app/(dashboard)/staff/[id]/page.tsx");

  assert.match(
    workforce,
    /setAttendanceEntriesAvailable\(entriesResult\.status === "fulfilled"\)/,
  );
  assert.match(workforce, /"Unavailable"/);
  assert.match(
    workforce,
    /Attendance review unavailable\. Attendance entries could not be loaded\./,
  );
  assert.match(
    workforce,
    /attendanceEntriesAvailable &&\s*!attendanceReview\.length/,
  );
  assert.match(detail, /setAttendanceAvailable\(/);
  assert.match(detail, /setScheduleAvailable\(/);
  assert.match(detail, /setLeaveAvailable\(/);
  assert.match(detail, /attendanceAvailable\s*\? \[/);
  assert.match(
    detail,
    /Attendance information is unavailable for your access level/,
  );
  assert.match(
    detail,
    /Attendance information is unavailable for your access level/,
  );
  assert.doesNotMatch(
    detail,
    /title="Attendance unavailable"[\s\S]*These records could not be loaded/,
  );
});

test("financial dates, full currency values, and access utility presentation stay readable", () => {
  const workforce = read("app/(dashboard)/workforce/page.tsx");
  const staff = read("app/(dashboard)/staff/page.tsx");
  const register = read("components/staff/staff-register.tsx");
  const performance = read("components/staff/staff-performance-card.tsx");
  const access = read("app/(dashboard)/staff/join-requests/page.tsx");
  assert.match(workforce, /className: "col-span-2 lg:col-span-1"/);
  assert.match(workforce, /valueClassName: "whitespace-nowrap"/);
  assert.doesNotMatch(`${staff}\n${register}`, /DueAmountLabel|Due Amount/);
  assert.match(performance, /formatDate\(dateFrom\)/);
  assert.match(performance, /<section className="space-y-4">/);
  assert.match(performance, /<WorkforceMetricStrip/);
  assert.match(access, /<PageHeader/);
  assert.match(access, /title="Restaurant access"/);
  assert.doesNotMatch(access, /Access center/);
  assert.doesNotMatch(access, /bg-gradient-to-br/);
});

test("migration record keeps Staff Stage 3 pending manual QA", () => {
  const doc = read("docs/WEB_UI_SYSTEM_MIGRATION.md");

  assert.match(
    doc,
    /\| Wave 8\s+\| Workforce \/ Staff\s+\| FOUNDATION-COMPLIANT — Stage 1\/2 approved; Stage 3 desktop completion pending manual QA/,
  );
  assert.match(doc, /Wave 8 Staff Register presentation grammar/);
  assert.match(doc, /Wave 8 Staff Detail presentation grammar/);
  assert.match(doc, /`\/staff\/\[id\]`/);
  assert.match(doc, /Staff Register and Staff Detail await manual QA/);
});
