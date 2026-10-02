const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Finance Settings owns configuration while operational workflows remain linked", () => {
  const route = read("app/(dashboard)/settings/finance/page.tsx");
  const workspace = read("components/settings/finance-settings-workspace.tsx");
  const legacy = read("app/(dashboard)/finance/setup/page.tsx");

  assert.match(route, /FinanceSettingsWorkspace/);
  assert.match(workspace, /activeItemId="finance_setup"/);
  assert.match(workspace, /title="Currency"/);
  assert.match(workspace, /restaurant\?\.currency/);
  assert.match(workspace, /\/finance\/heads/);
  assert.match(workspace, /\/finance\/operations\?tab=accounts/);
  assert.match(workspace, /\/finance\/operations\?tab=payment-instruments/);
  assert.match(workspace, /\/finance\/operations\?tab=cash-drawers/);
  assert.doesNotMatch(workspace, /Finance reports|Day close|ledger/);
  assert.match(legacy, /redirect\("\/settings\/finance"\)/);
});

test("Taxes keep existing mutations inside a Settings-owned workspace", () => {
  const route = read("app/(dashboard)/settings/taxes/page.tsx");
  const workspace = read("components/settings/tax-settings-workspace.tsx");
  const legacy = read("app/(dashboard)/manage/taxes/page.tsx");

  assert.match(route, /TaxSettingsWorkspace/);
  assert.match(workspace, /activeItemId="tax_configuration"/);
  assert.match(workspace, /TaxConfigApis\.list/);
  assert.match(workspace, /TaxConfigApis\.delete/);
  assert.match(workspace, /RestaurantApis\.update/);
  assert.match(workspace, /isActiveVat/);
  assert.match(workspace, /<LoadingState/);
  assert.match(workspace, /<ErrorState/);
  assert.match(workspace, /<EmptyState/);
  assert.match(legacy, /redirect\("\/settings\/taxes"\)/);
});

test("Payment Integrations owns FonePay without absorbing checkout or settlement", () => {
  const route = read("app/(dashboard)/settings/payment-integrations/page.tsx");
  const workspace = read(
    "components/settings/payment-integrations-workspace.tsx",
  );
  const legacyOperations = read("app/(dashboard)/manage/settings/page.tsx");

  assert.match(route, /PaymentIntegrationsWorkspace/);
  assert.match(workspace, /activeItemId="payment_integrations"/);
  assert.match(workspace, /RestaurantApis\.updateFonepay/);
  assert.match(workspace, /Provider status/);
  assert.match(workspace, /\/finance\/operations\?tab=payment-instruments/);
  assert.match(workspace, /\/finance\/operations\?tab=accounts/);
  assert.doesNotMatch(workspace, /checkout\/page|sales|Day close/);
  assert.match(
    legacyOperations,
    /router\.replace\("\/settings\/payment-integrations"\)/,
  );
});

test("the centralized Settings model owns all three Finance destinations", () => {
  const model = read("lib/settings-navigation.ts");

  assert.match(
    model,
    /id: "finance_setup"[\s\S]*?route: "\/settings\/finance"[\s\S]*?mobileBackTarget: "\/settings"/,
  );
  assert.match(
    model,
    /id: "tax_configuration"[\s\S]*?route: "\/settings\/taxes"/,
  );
  assert.match(
    model,
    /id: "payment_integrations"[\s\S]*?route: "\/settings\/payment-integrations"/,
  );
});
