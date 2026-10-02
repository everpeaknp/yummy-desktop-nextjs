const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Hardware and documents uses canonical Settings routes", () => {
  const model = read("lib/settings-navigation.ts");
  const workspace = read(
    "components/settings/hardware-documents-settings-workspace.tsx",
  );

  assert.match(
    model,
    /id: "printer_management"[\s\S]*?route: "\/settings\/printers"[\s\S]*?surface: "route"/,
  );
  assert.match(
    model,
    /id: "receipt_designer"[\s\S]*?route: "\/settings\/receipt-designer"/,
  );
  assert.match(
    model,
    /id: "kot_designer"[\s\S]*?route: "\/settings\/kot-designer"/,
  );
  assert.match(workspace, /SettingsDesktopRail/);
  assert.match(workspace, /activeItemId: "printer_management"/);
  assert.match(workspace, /activeItemId: "receipt_designer"/);
  assert.match(workspace, /activeItemId: "kot_designer"/);
  assert.match(workspace, /<LoadingState/);
  assert.match(workspace, /<ErrorState/);
});

test("legacy designer routes redirect to their Settings owners", () => {
  const receiptLegacy = read(
    "app/(dashboard)/manage/receipt-designer/page.tsx",
  );
  const kotLegacy = read("app/(dashboard)/manage/kot-designer/page.tsx");
  const receiptLayout = read(
    "app/(dashboard)/settings/receipt-designer/layout.tsx",
  );
  const kotLayout = read("app/(dashboard)/settings/kot-designer/layout.tsx");

  assert.match(receiptLegacy, /redirect\("\/settings\/receipt-designer"\)/);
  assert.match(kotLegacy, /redirect\("\/settings\/kot-designer"\)/);
  assert.match(receiptLayout, /designers\.receipt\.enabled/);
  assert.match(kotLayout, /designers\.kot\.enabled/);
});

test("printer management preserves hardware and routing contracts", () => {
  const printers = read("components/manage/settings/printer-management.tsx");

  for (const contract of [
    "PrinterApis.list",
    "PrinterApis.create",
    "PrinterApis.update",
    "PrinterApis.delete",
    "PrinterApis.test",
    "StationApis.list",
    "StationApis.updateStation",
    "receipt_printer_id",
    "yummy_local_kot_stations",
  ]) {
    assert.match(printers, new RegExp(contract.replaceAll(".", "\\.")));
  }
  assert.match(printers, /md:hidden/);
  assert.match(printers, /<LoadingState/);
  assert.match(printers, /<ErrorState/);
  assert.match(printers, /<EmptyState/);
});

test("document designers preserve template mutations and use responsive workspaces", () => {
  const receipt = read("components/manage/settings/receipt-designer.tsx");
  const kot = read("components/manage/settings/kot-designer.tsx");

  assert.match(receipt, /RestaurantApis\.updateTemplates/);
  assert.match(receipt, /receipt_template: templateData/);
  assert.match(receipt, /xl:grid-cols-\[minmax\(420px,1fr\)_320px\]/);
  assert.match(receipt, /Payment receipt/);
  assert.match(receipt, /Pre-bill/);
  assert.match(
    receipt,
    /mappedBlocks\.find\(\(block\) => block\.type === "header"\)/,
  );
  assert.match(receipt, /mappedBlocks\[0\]\?\.id/);
  assert.match(receipt, /previewExpanded/);
  assert.match(receipt, /setPreviewExpanded\(true\)/);
  assert.doesNotMatch(receipt, /setPreviewExpanded\(false\)/);
  assert.match(receipt, /<MobileDesignerEditorSheet/);
  assert.match(receipt, /mobileDraftBlock/);
  assert.match(receipt, /xl:sticky xl:top-24/);
  assert.doesNotMatch(receipt, />Layout settings</);
  assert.match(receipt, /Print defaults/);
  assert.match(receipt, /href="\/settings\/printers"/);

  assert.match(kot, /RestaurantApis\.updateTemplates/);
  assert.match(kot, /kot_template: templateData/);
  assert.match(kot, /xl:grid-cols-\[minmax\(420px,1fr\)_320px\]/);
  assert.match(kot, /Kitchen ticket preview/);
  assert.match(
    kot,
    /mappedBlocks\.find\(\(block\) => block\.type === "header"\)/,
  );
  assert.match(kot, /mappedBlocks\[0\]\?\.id/);
  assert.match(kot, /previewExpanded/);
  assert.match(kot, /setPreviewExpanded\(true\)/);
  assert.doesNotMatch(kot, /setPreviewExpanded\(false\)/);
  assert.match(kot, /<MobileDesignerEditorSheet/);
  assert.match(kot, /mobileDraftBlock/);
  assert.match(kot, /xl:sticky xl:top-24/);
  assert.doesNotMatch(kot, />Layout settings</);
  assert.match(kot, /mode="kot"/);
});

test("designer controls prioritize content and disclose advanced styling", () => {
  const components = read("components/manage/settings/designer-components.tsx");

  assert.match(components, /Block styling/);
  assert.match(components, /aria-expanded=\{stylingOpen\}/);
  assert.match(components, /mode === "receipt"/);
  assert.match(components, /Click to edit/);
  assert.match(components, /existingBlock/);
  assert.match(components, /"Disabled"/);
  assert.match(components, /side="bottom"/);
  assert.match(components, /rounded-t-2xl/);
  assert.match(components, /onCancel/);
  assert.match(components, /onSave/);
  assert.match(components, /scrollIntoView/);
  assert.match(components, /blockRefs\.current\.get\(selectedId\)/);
});

test("the Settings hub no longer embeds printer management", () => {
  const hub = read("components/settings/settings-hub.tsx");
  const search = read("components/layout/global-search.tsx");

  assert.doesNotMatch(hub, /<PrinterManagement/);
  assert.doesNotMatch(hub, /case "printer_management"/);
  assert.match(search, /href: "\/settings\/printers"/);
  assert.match(search, /href: "\/settings\/receipt-designer"/);
  assert.match(search, /href: "\/settings\/kot-designer"/);
});
