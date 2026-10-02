const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Staff Register reuses the approved product register primitives", () => {
  const register = read("components/staff/staff-register.tsx");
  const page = read("app/(dashboard)/staff/page.tsx");

  assert.match(page, /<AppPage width="register"/);
  assert.match(page, /<PageHeader/);
  assert.doesNotMatch(register, /<SegmentedControl/);
  assert.match(register, /<SearchField/);
  assert.match(register, /<DataList className="lg:hidden">/);
  assert.match(register, /<ListRow/);
  assert.match(register, /<Table>/);
  assert.match(
    register,
    /hidden max-w-full overflow-x-auto rounded-2xl border border-border bg-card lg:block/,
  );
  assert.doesNotMatch(register, /min-h-\[116px\]|function mobileStatus/);
  assert.doesNotMatch(register, /border-y lg:hidden/);
});

test("Add staff is a register action rather than a navigation tab", () => {
  const page = read("app/(dashboard)/staff/page.tsx");
  const register = read("components/staff/staff-register.tsx");
  const joinCode = read("components/staff/staff-join-code-panel.tsx");

  assert.doesNotMatch(register, /StaffSection|Staff management sections/);
  assert.match(register, /onClick=\{\(\) => onAddStaffOpenChange\(true\)\}/);
  assert.match(register, /<MobileCreateFab/);
  assert.match(register, /label="Add staff"/);
  assert.match(
    page,
    /const \[addStaffOpen, setAddStaffOpen\] = useState\(false\)/,
  );
  assert.match(page, /onAddStaffOpenChange=\{setAddStaffOpen\}/);
  assert.match(register, /<Sheet open=\{addStaffOpen\}/);
  assert.match(register, /<SheetTitle>Add staff<\/SheetTitle>/);
  assert.match(register, /Invite by email/);
  assert.match(register, /<StaffJoinCodePanel canManage=\{canManageStaff\}/);
  assert.match(joinCode, /aria-label="Join code"/);
  assert.match(register, /Pending requests/);
  assert.match(register, />Invitations</);
  assert.ok(
    register.indexOf("Invite by email") <
      register.indexOf("<StaffJoinCodePanel"),
  );
  assert.ok(
    register.indexOf("<StaffJoinCodePanel") <
      register.indexOf("Pending requests"),
  );
  assert.ok(
    register.indexOf("Pending requests") < register.indexOf(">Invitations<"),
  );
});

test("mobile Staff and invitation rows use ListRow anatomy", () => {
  const register = read("components/staff/staff-register.tsx");

  assert.match(
    register,
    /<DataList className="lg:hidden">[\s\S]*filteredMembers\.map[\s\S]*<ListRow/,
  );
  assert.match(register, /title=\{member\.name \|\| "Staff member"\}/);
  assert.match(
    register,
    /const description = \[\s*staffRoleLabel\(staffRole\(member\)\),\s*member\.email \|\| "No email",\s*\]/,
  );
  assert.doesNotMatch(
    register,
    /const description = \[[\s\S]{0,180}Setup needed/,
  );
  assert.match(
    register,
    /meta=\{staffDirectoryStateLabel\(member, setupState\)\}/,
  );
  assert.match(register, /interactive/);
  assert.match(register, /onClick=\{\(\) => onOpenMember\(member\)\}/);
  assert.match(
    register,
    /invitations\.map\(\(invitation\) => \([\s\S]*<ListRow/,
  );
  assert.match(register, /invitationDescription\(invitation\)/);
  assert.match(register, /invitationStatusLabel\(invitation\.status\)/);
});

test("desktop Staff and invitation registers use the standard bounded table", () => {
  const register = read("components/staff/staff-register.tsx");

  for (const heading of [
    "Staff member",
    "Role",
    "Status",
    "Setup",
    "Contact",
    "Invitee",
    "Expires",
  ]) {
    assert.match(register, new RegExp(`>${heading}<`));
  }
  assert.equal((register.match(/<Table>/g) || []).length, 2);
});

test("invitations use existing API data and preserve resend and revoke", () => {
  const page = read("app/(dashboard)/staff/page.tsx");
  const register = read("components/staff/staff-register.tsx");
  const presentation = read("lib/presentation/staff-directory.ts");

  assert.match(page, /apiClient\.get\(RestaurantJoinApis\.invitations\)/);
  assert.match(page, /RestaurantJoinApis\.resendInvitation\(invitation\.id\)/);
  assert.match(page, /RestaurantJoinApis\.revokeInvitation\(invitation\.id\)/);
  assert.match(page, /extend_days: 7/);
  assert.match(register, /Replace and resend/);
  assert.match(register, /Revoke invitation/);
  assert.match(presentation, /pending: "Pending"/);
  assert.match(presentation, /accepted: "Accepted"/);
  assert.match(presentation, /expired: "Expired"/);
  assert.match(presentation, /revoked: "Revoked"/);
  assert.match(presentation, /replaceAll\("_", " "\)/);
});

test("one shared join-code implementation serves Staff and access review", () => {
  const register = read("components/staff/staff-register.tsx");
  const access = read("app/(dashboard)/staff/join-requests/page.tsx");
  const joinCode = read("components/staff/staff-join-code-panel.tsx");

  assert.match(register, /<StaffJoinCodePanel canManage=\{canManageStaff\}/);
  assert.match(access, /<StaffJoinCodePanel canManage=\{canManageRequests\}/);
  assert.match(joinCode, /RestaurantJoinApis\.currentCode/);
  assert.match(joinCode, /RestaurantJoinApis\.rotateCode/);
  assert.match(joinCode, /QRCode\.toDataURL/);
  assert.match(joinCode, />\s*View QR\s*</);
  assert.match(joinCode, />\s*Copy\s*</);
  assert.match(joinCode, />\s*Share\s*</);
  assert.match(joinCode, />\s*Save\s*</);
  assert.match(joinCode, />\s*Print\s*</);
  assert.match(joinCode, /Rotate code/);
  assert.match(joinCode, /window\.confirm/);
  assert.doesNotMatch(
    access,
    /QRCode\.toDataURL|RestaurantJoinApis\.currentCode/,
  );
});

test("Staff Register keeps failure, empty, and unknown states truthful", () => {
  const page = read("app/(dashboard)/staff/page.tsx");
  const register = read("components/staff/staff-register.tsx");
  const presentation = read("lib/presentation/staff-directory.ts");

  assert.match(register, /Staff could not be loaded/);
  assert.match(register, /No staff yet/);
  assert.match(register, /No staff match these filters/);
  assert.match(register, /Invitations could not be loaded/);
  assert.match(register, /Requests could not be loaded/);
  assert.match(register, /No invitations yet/);
  assert.match(register, /accessRequestLoadState === "error"/);
  assert.match(register, /invitationLoadState === "error"/);
  assert.match(register, /profileLoadState === "error"/);
  assert.match(register, /Setup status is unavailable/);
  assert.match(
    presentation,
    /profileLoadState === "error".*return "unavailable"/s,
  );
  assert.match(page, /setPendingAccessRequests\(null\)/);
  assert.doesNotMatch(page, /setPendingAccessRequests\(0\)/);
});

test("Add staff is a compact administration sheet without losing independent workflows", () => {
  const register = read("components/staff/staff-register.tsx");
  const joinCode = read("components/staff/staff-join-code-panel.tsx");

  assert.match(register, /px-4 py-3 text-left sm:px-5 sm:py-4/);
  assert.match(register, /id="staff-invite-by-email"/);
  assert.match(register, />\s*Invite\s*</);
  assert.match(register, /className="h-11 w-full rounded-xl sm:w-auto"/);
  assert.match(register, /compactMobile/);
  assert.match(register, /No pending requests/);
  assert.match(
    register,
    /New join requests will appear after staff scan the join\s*code\./,
  );
  assert.doesNotMatch(
    register,
    /<EmptyState[\s\S]{0,180}title="No pending requests"/,
  );
  assert.doesNotMatch(
    register,
    /Pending requests<\/h3>[\s\S]{0,180}Review people who scanned/,
  );
  assert.match(
    register,
    /<DataList className="lg:hidden">[\s\S]*invitations\.map/,
  );
  assert.match(register, /action=\{invitationActions\(/);
  assert.match(register, /return \[role, email, expires\]/);
  assert.match(register, /No invitations yet\./);
  assert.match(register, /Invitations could not be loaded/);
  assert.match(register, /Requests could not be loaded/);
  assert.match(joinCode, /compactMobile \? "mt-3" : "mt-4"/);
  assert.match(joinCode, /Staff scan this code to request access\./);
  assert.match(joinCode, />\s*View QR\s*</);
  assert.match(joinCode, />\s*Copy\s*</);
  assert.match(joinCode, />\s*Share\s*</);
  assert.match(joinCode, /Rotate code/);
  assert.match(joinCode, /Download QR/);
  assert.match(joinCode, />\s*Save\s*</);
  assert.match(joinCode, />\s*Print\s*</);
  assert.match(joinCode, /renderJoinCodeMenu\(true\)/);
  assert.match(joinCode, /!compactMobile \? \(/);
  assert.doesNotMatch(joinCode, /compactMobile \? "mt-1 h-9 px-0"/);

  const menuStart = joinCode.indexOf("const renderJoinCodeMenu");
  const menuEnd = joinCode.indexOf("const joinCodeMenu");
  const compactMenu = joinCode.slice(menuStart, menuEnd);
  assert.ok(compactMenu.indexOf("Share") < compactMenu.indexOf("Rotate code"));
  assert.ok(
    compactMenu.indexOf("Rotate code") < compactMenu.indexOf("Download QR"),
  );
  assert.ok(compactMenu.indexOf("Download QR") < compactMenu.indexOf("Print"));
});

test("join requests remain a separate linked queue", () => {
  const register = read("components/staff/staff-register.tsx");

  assert.match(register, /href="\/staff\/join-requests"/);
  assert.match(register, /title="Review access requests"/);
  assert.match(register, /pendingAccessRequests/);
  assert.doesNotMatch(register, /invitations\.concat|concat\(invitations/);
});

test("search and filters retain authoritative Staff semantics", () => {
  const register = read("components/staff/staff-register.tsx");
  const filterBar = read("components/patterns/controls/filter-bar.tsx");
  const presentation = read("lib/presentation/staff-directory.ts");

  assert.match(register, /Search name or email/);
  assert.match(register, /All statuses/);
  assert.match(register, /staffDirectoryRoleOptions\(members\)/);
  assert.match(register, /All setup states/);
  assert.match(register, /Clear filters/);
  assert.match(register, /<FilterBar/);
  assert.match(register, /<MobileRegisterToolbar/);
  assert.match(register, /mobileTriggerVariant="icon"/);
  assert.match(register, /activeCount=\{activeFilterCount\}/);
  assert.match(filterBar, /"full" \| "compact" \| "icon"/);
  assert.match(filterBar, /mobileTriggerVariant === "compact"/);
  assert.match(presentation, /members\.map\(staffRole\)/);
  assert.doesNotMatch(
    register,
    /SelectItem value="(admin|manager|chef|waiter|cashier)"/,
  );
});

test("Staff Add follows the product register pattern without cluttering the mobile app bar", () => {
  const page = read("app/(dashboard)/staff/page.tsx");
  const header = read("components/layout/header.tsx");
  const register = read("components/staff/staff-register.tsx");

  assert.match(page, /hasPermission\(user, "admin\.staff\.manage"\)/);
  assert.match(header, /<MobileAppBar/);
  assert.doesNotMatch(page, /<PageHeader[\s\S]*>\s*Add staff\s*</);
  assert.match(
    register,
    /<FilterBar[\s\S]*className="hidden lg:block"[\s\S]*actions=\{[\s\S]*Add staff/,
  );
  assert.match(register, /<MobileCreateFab[\s\S]*label="Add staff"/);
  assert.match(register, /\{canManageStaff \? \(/);
  assert.doesNotMatch(header, /STAFF_ADD_EVENT|STAFF_PAY_ALL_EVENT/);
  assert.doesNotMatch(header, /aria-label="Staff actions"/);
  assert.doesNotMatch(header, /Pay all salaries|Manage roles/);
  assert.doesNotMatch(page, /<PayAllPreviewDialog|headerActions/);
});

test("desktop Staff invitations use the wider administration workspace", () => {
  const register = read("components/staff/staff-register.tsx");

  assert.match(register, /sm:max-w-3xl lg:max-w-5xl/);
  assert.match(
    register,
    /lg:flex lg:items-center lg:justify-between lg:gap-6 lg:space-y-0/,
  );
  assert.equal((register.match(/<Table>/g) || []).length, 2);
});

test("directory summary follows the results instead of leading the page", () => {
  const register = read("components/staff/staff-register.tsx");

  const searchIndex = register.indexOf("<SearchField");
  const resultsIndex = register.indexOf('<DataList className="lg:hidden">');
  const summaryIndex = register.indexOf('loadState === "loaded"');
  const addSheetIndex = register.indexOf("<Sheet open={addStaffOpen}");

  assert.ok(searchIndex >= 0 && searchIndex < resultsIndex);
  assert.ok(resultsIndex < summaryIndex && summaryIndex < addSheetIndex);
  assert.match(register, /\{counts\.active\} active/);
  assert.match(register, /\{setupAttention\} need setup/);
});

test("directory excludes balances and technical identifiers", () => {
  const page = read("app/(dashboard)/staff/page.tsx");
  const register = read("components/staff/staff-register.tsx");
  const visibleDirectory = `${page}\n${register}`;

  assert.doesNotMatch(visibleDirectory, /Due Amount|DueAmountLabel|#STF-/);
  assert.doesNotMatch(register, /net_due|Salary due|Staff advances/);
  assert.doesNotMatch(register, /user_id|staff-profile ID|permission count/i);
});

test("migration status records approved Staff foundations and pending Stage 3 QA", () => {
  const migration = read("docs/WEB_UI_SYSTEM_MIGRATION.md");

  assert.match(migration, /Wave 8 Staff Register presentation grammar/);
  assert.match(migration, /Staff Detail is APPROVED/);
  assert.match(
    migration,
    /Stage 1\/2 approved; Stage 3 desktop completion pending manual QA/,
  );
});
