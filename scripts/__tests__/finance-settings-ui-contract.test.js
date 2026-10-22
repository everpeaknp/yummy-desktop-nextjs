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
  assert.match(workspace, /restaurant\.fonepay_pid/);
  assert.match(workspace, /fonepay_enabled: configuration\.is_active/);
  assert.match(workspace, /fonepay_pid: configuration\.merchant_code/);
  assert.doesNotMatch(workspace, /restaurant\.fonepay_config/);
  assert.match(workspace, /Provider status/);
  assert.match(workspace, /\/finance\/operations\?tab=payment-instruments/);
  assert.match(workspace, /\/finance\/operations\?tab=accounts/);
  assert.doesNotMatch(workspace, /checkout\/page|sales|Day close/);
  assert.match(
    legacyOperations,
    /router\.replace\("\/settings\/payment-integrations"\)/,
  );
});

test("Grow SMS checkout recognizes Fonepay's qrMessage response field", () => {
  const workspace = read("components/grow/growth-settings-client.tsx");

  assert.match(workspace, /"qrMessage"/);
  assert.match(workspace, /checkSmsPayment\(purchaseId, true\)/);
  assert.match(workspace, /window\.setInterval/);
  assert.doesNotMatch(workspace, /purchaseStatus/);
});

test("Subscription plans use secure self-service checkout with automatic verification and QR download", () => {
  const page = read("app/(dashboard)/premium/page.tsx");
  const api = read("lib/subscription/api.ts");

  assert.match(page, /`Choose \$\{plan\.name\}`/);
  assert.match(page, /Continue with Fonepay/);
  assert.match(page, /Choose your plan/);
  assert.match(page, /subscriptionApi\.createCheckout/);
  assert.match(page, /window\.setInterval\(\(\) => void poll\(\), 4_000\)/);
  assert.match(page, /downloadPaymentQr/);
  assert.match(page, /closePurchaseDialog/);
  assert.match(page, /subscriptionApi\.supersedeFonepayCheckout/);
  assert.match(page, /Cancel checkout & choose another plan/);
  assert.match(page, /Checkout closes in/);
  assert.match(page, /Purchase summary/);
  assert.match(page, /How to pay/);
  assert.match(page, /Payment verified\. Your subscription is active\./);
  assert.match(page, /Only verified, fully paid invoices appear here\./);
  assert.match(page, /checkoutStatus !== "expired"/);
  assert.doesNotMatch(page, />Pay with Fonepay</);
  assert.match(api, /SubscriptionApis\.checkout/);
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
