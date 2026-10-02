const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Staff uses one responsive profile, employment, and access editor", () => {
  const page = read("app/(dashboard)/staff/[id]/page.tsx");
  const editor = read("components/staff/staff-edit-dialog.tsx");

  assert.match(page, /<StaffEditDialog/);
  assert.doesNotMatch(page, /Edit staff account/);
  assert.doesNotMatch(page, /Edit employment and pay profile/);
  assert.doesNotMatch(page, /<DialogTitle>Change role<\/DialogTitle>/);
  assert.match(editor, /h-\[100dvh\]/);
  assert.match(editor, /lg:max-w-3xl/);
  assert.match(editor, /<TabsTrigger value="profile">Profile/);
  assert.match(editor, /<TabsTrigger value="employment">Employment/);
  assert.match(editor, /<TabsTrigger value="access">Access/);
  assert.match(editor, /title="Access"[\s\S]*\{roleField\}/);
  assert.match(editor, /border-t bg-background/);
  assert.match(editor, /"Save changes"/);
});

test("register edit and setup actions enter the canonical Staff editor", () => {
  const registerPage = read("app/(dashboard)/staff/page.tsx");
  const detailPage = read("app/(dashboard)/staff/[id]/page.tsx");

  assert.match(registerPage, /`\/staff\/\$\{member\.id\}\?edit=profile`/);
  assert.match(registerPage, /`\/staff\/\$\{member\.id\}\?edit=employment`/);
  assert.match(detailPage, /searchParams\.get\("edit"\)/);
  assert.doesNotMatch(registerPage, /Set up staff profile<\/DialogTitle>/);
  assert.doesNotMatch(registerPage, /editingStaff|Edit Staff Member/);
});

test("unified save preserves the established account and pay mutations", () => {
  const page = read("app/(dashboard)/staff/[id]/page.tsx");

  assert.match(page, /apiClient\.patch\(StaffApis\.update\(userId\)/);
  assert.match(page, /StaffProfileApis\.update\(profile\.id\)/);
  assert.match(page, /apiClient\.post\(StaffProfileApis\.create/);
  assert.match(page, /salary_change_reason/);
  assert.match(page, /canChangeGlobalStatus/);
  assert.match(page, /currentPermissions\.has\("platform\.staff\.manage"\)/);
});

test("permission drill-down is searchable, grouped, and explains provenance", () => {
  const page = read("app/(dashboard)/staff/[id]/page.tsx");

  assert.match(page, /placeholder="Search permissions"/);
  assert.match(page, /permission\.module \|\| "Other"/);
  assert.match(page, /permissionMode\(permission\.key\)/);
  assert.match(page, /inherited \? "Inherited" : "Direct"/);
  assert.match(page, /disabled=\{inherited\}/);
  assert.match(page, /Save direct access/);
  assert.match(page, /AuthApis\.updateUserPermissions\(userId\)/);
});

test("history restrictions share presets and membership danger stays separate", () => {
  const page = read("app/(dashboard)/staff/[id]/page.tsx");

  for (const label of [
    "Analytics history",
    "Order history",
    "Receipt history",
    "Full history",
    "40 days",
    "Custom limit",
  ]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /UserAccessScopeApis\.upsert/);
  assert.match(page, /UserAccessScopeApis\.remove/);
  assert.match(page, /Remove from restaurant/);
  assert.match(page, /removeStaffMembership/);
  assert.doesNotMatch(
    read("components/staff/staff-edit-dialog.tsx"),
    /Remove from restaurant|Delete staff/,
  );
});
