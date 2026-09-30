const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Roles & permissions is a Settings-owned reusable role workspace", () => {
  const route = read("app/(dashboard)/settings/roles/page.tsx");
  const workspace = read("app/(dashboard)/manage/roles/page.tsx");

  assert.match(route, /manage\/roles\/page/);
  assert.match(workspace, /activeItemId="roles"/);
  assert.match(workspace, /title="Roles & permissions"/);
  assert.match(workspace, /RoleApis\.listRoles/);
  assert.match(workspace, /RoleApis\.listPermissions/);
  assert.match(workspace, /RoleApis\.listBuiltInRoles/);
  assert.match(workspace, /RoleApis\.createRole/);
  assert.match(workspace, /RoleApis\.updateRole/);
  assert.match(workspace, /RoleApis\.deleteRole/);
  assert.match(workspace, /placeholder="Search permissions"/);
  assert.match(workspace, /<DataList/);
  assert.doesNotMatch(workspace, /staff\/\[id\]|UserAccessScopeApis/);
});

test("Administrators uses the existing restaurant administrator lifecycle API", () => {
  const route = read("app/(dashboard)/settings/administrators/page.tsx");
  const workspace = read(
    "components/settings/administrators-settings-workspace.tsx",
  );

  assert.match(route, /AdministratorsSettingsWorkspace/);
  assert.match(workspace, /activeItemId="admin_management"/);
  assert.match(workspace, /AdminManagementApis\.restaurantAdmins/);
  assert.match(workspace, /AdminManagementApis\.removeAdmin/);
  assert.match(workspace, /AdminManagementApis\.transferOwnership/);
  assert.match(workspace, /Invite administrator/);
  assert.match(workspace, /<LoadingState/);
  assert.match(workspace, /<ErrorState/);
  assert.match(workspace, /<EmptyState/);
});

test("Settings navigation owns People & access destinations without exposing an inline admin implementation", () => {
  const model = read("lib/settings-navigation.ts");
  const hub = read("components/settings/settings-hub.tsx");

  assert.match(
    model,
    /id: "roles"[\s\S]*?route: "\/settings\/roles"[\s\S]*?permission: "admin\.roles\.manage"/,
  );
  assert.match(
    model,
    /id: "admin_management"[\s\S]*?route: "\/settings\/administrators"[\s\S]*?permission: "admin\.staff\.manage"/,
  );
  assert.doesNotMatch(hub, /case "admin_management"/);
  assert.doesNotMatch(hub, /<AdminManagement/);
});

test("Staff access continues to own individual role and exception assignments", () => {
  const staffDetail = read("app/(dashboard)/staff/[id]/page.tsx");
  const staffEdit = read("components/staff/staff-edit-dialog.tsx");

  assert.match(staffDetail, /UserAccessScopeApis/);
  assert.match(staffEdit, /assigned_role|permission/i);
});
