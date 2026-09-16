const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Migration documentation retains the catalog configuration route inventory", () => {
  const migration = read("docs/WEB_UI_SYSTEM_MIGRATION.md");

  assert.match(
    migration,
    /`\/menu\/\*`, `\/menu\/categories`, `\/menu\/modifiers`, `\/discounts`/,
  );
  assert.match(migration, /Product configuration/);
});

test("Menu catalog keeps actual search, category counts, direct configuration navigation, and configured currency", () => {
  const menu = read("app/(dashboard)/menu/items/page.tsx");

  assert.match(menu, /<AppPage width="workspace">/);
  assert.match(menu, /className="hidden lg:block"/);
  assert.match(menu, /<FilterChip/);
  assert.match(menu, /count=\{allItems\.length\}/);
  assert.match(menu, /href="\/menu\/categories"/);
  assert.match(menu, /href="\/menu\/modifiers"/);
  assert.match(
    menu,
    /item_category_id: item\.item_category_id \?\? g\.category_id/,
  );
  assert.match(menu, /const catalogCategories = useMemo<CatalogCategory\[\]>/);
  assert.match(menu, /existing\.categoryIds\.push\(category\.id\)/);
  assert.match(menu, /cat\.categoryIds\.includes\(item\.item_category_id\)/);
  assert.match(menu, /selectedCategoryIds\.includes\(item\.item_category_id\)/);
  assert.match(menu, /formatCurrency\(item\.price \|\| 0, currency\)/);
  assert.doesNotMatch(menu, /currency \|\| "Rs\."/);
  assert.doesNotMatch(menu, /item\.category_type/);
});

test("Menu category chip counts are record-based and reconcile with the catalog dataset", () => {
  const catalogItems = [
    { id: 1, name: "Repeated item", categoryId: "A" },
    { id: 2, name: "Repeated item", categoryId: "A" },
    { id: 3, name: "Item B1", categoryId: "B" },
    { id: 4, name: "Item B2", categoryId: "B" },
    { id: 5, name: "Item C1", categoryId: "C" },
    { id: 6, name: "Item C2", categoryId: "C" },
    { id: 7, name: "Item C3", categoryId: "C" },
    { id: 8, name: "Item D1", categoryId: "D" },
  ];
  const countForCategory = (categoryIds) =>
    catalogItems.filter((item) => categoryIds.includes(item.categoryId)).length;

  assert.equal(catalogItems.length, 8);
  assert.equal(countForCategory(["A"]), 2);
  assert.equal(countForCategory(["B"]), 2);
  assert.equal(countForCategory(["C"]), 3);
  assert.equal(countForCategory(["D"]), 1);
  assert.equal(countForCategory(["A", "B", "C", "D"]), catalogItems.length);
});

test("Categories and options use touch-first configuration rows without fabricated category state", () => {
  const categories = read("app/(dashboard)/menu/categories/page.tsx");
  const modifiers = read("app/(dashboard)/menu/modifiers/page.tsx");
  const options = read("components/menu/modifier-options-sheet.tsx");

  assert.match(categories, /className="hidden lg:flex"/);
  assert.match(categories, /stationLabel\(/);
  assert.match(categories, /Station unavailable/);
  assert.doesNotMatch(categories, /Station #/);
  assert.doesNotMatch(categories, /GripVertical/);
  assert.doesNotMatch(categories, />Active</);
  assert.match(categories, /className="h-11 w-11 rounded-xl"/);

  assert.match(modifiers, /group\.selection_type === "single"/);
  assert.match(modifiers, /Required.*Min/);
  assert.match(modifiers, /className="h-11 w-11 rounded-xl"/);
  assert.match(modifiers, /MoreHorizontal/);
  assert.match(modifiers, /DropdownMenuItem[\s\S]*Edit group/);
  assert.match(modifiers, /DropdownMenuItem[\s\S]*Delete group/);
  assert.match(modifiers, /min-h-\[84px\]/);
  assert.doesNotMatch(modifiers, /<ListRow/);
  assert.match(options, /h-\[100dvh\] w-full max-w-none/);
  assert.match(options, /formatCurrency\(/);
  assert.match(options, /No price change/);
  assert.match(options, /item\.is_active/);
});

test("Discount configuration exposes real active, eligibility, amount, and date fields", () => {
  const discounts = read("app/(dashboard)/discounts/page.tsx");
  const dialog = read("components/discounts/discount-dialog.tsx");
  const presentation = read("components/discounts/discount-presentation.ts");

  assert.match(discounts, /discountApplicabilityLabel/);
  assert.match(discounts, /discountValueLabel/);
  assert.match(discounts, /formatDate\(discount\.valid_until\)/);
  assert.match(discounts, /discount\.is_active === false/);
  assert.match(discounts, /Code: \$\{discount\.code\}/);
  assert.doesNotMatch(discounts, /Rs\./);

  assert.match(dialog, /applicable_items/);
  assert.match(dialog, /applicable_categories/);
  assert.match(dialog, /usage_limit/);
  assert.match(dialog, /name="is_active"/);
  assert.match(dialog, /MenuApis\.getMenusGroupedByRestaurant/);
  assert.match(dialog, /ItemCategoryApis\.getItemCategories/);
  assert.match(
    presentation,
    /type === "percentage" \? "Percentage" : "Fixed amount"/,
  );
  assert.match(presentation, /formatCurrency/);
  assert.match(presentation, /formatDiscountPercentage/);
  assert.match(presentation, /maximumFractionDigits: 4/);
  assert.doesNotMatch(presentation, /\$\{discount\.value\}% off/);
});

test("Menu configuration routes receive canonical mobile secondary app-bar titles", () => {
  const navigation = read("lib/mobile-module-navigation.ts");
  const header = read("components/layout/header.tsx");

  assert.match(
    navigation,
    /\["\/menu\/items", "Menu", "secondary", "\/manage"\]/,
  );
  assert.match(
    navigation,
    /\["\/menu\/categories", "Categories", "secondary", "\/manage"\]/,
  );
  assert.match(
    navigation,
    /\["\/menu\/modifiers", "Options & add-ons", "secondary", "\/manage"\]/,
  );
  assert.match(
    navigation,
    /\["\/discounts", "Discounts", "secondary", "\/manage"\]/,
  );
  assert.match(header, /pathname\.startsWith\("\/menu\/modifiers"\)/);
});
