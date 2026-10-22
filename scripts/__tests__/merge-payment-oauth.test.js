const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");

// Execute the actual handlers without mounting the checkout page or Electron.
function loadFunctions(file, names, bindings) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const functions = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) {
      functions.set(node.name.text, node.getText(ast));
    }
    if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) {
      let expression = node.initializer;
      if (ts.isCallExpression(expression) && expression.expression.getText(ast) === "useCallback") {
        expression = expression.arguments[0];
      }
      functions.set(node.name.getText(ast), `const ${node.name.getText(ast)} = ${expression.getText(ast)};`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(functions.size, names.length, `Missing handlers in ${file}`);
  const code = `${names.map((name) => functions.get(name)).join("\n")}\n({ ${names.join(", ")} });`;
  return vm.runInNewContext(ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, bindings);
}

function checkout(overrides = {}) {
  const state = { open: true, error: null, redirect: false };
  const bindings = {
    canProcessPayment: true,
    isMultiPayment: false,
    multiPayments: [40, 60].map((amount) => ({
      method: "cash", amount: String(amount), reference: "",
      selectedStaticQrIndex: 0, selectedCardIndex: 0,
    })),
    bill: { balance_due: 100, total_paid: 0 },
    orderId: 12, orderMeta: {}, selectedCustomerId: "",
    payAmount: "100", payReference: "", payMethod: "cash",
    selectedStaticQrIndex: 0, selectedCardIndex: 0,
    staticPaymentQrs: [], staticPaymentCards: [],
    paymentAttemptRef: { current: null },
    paymentSubmissionRef: { current: false },
    crypto: require("node:crypto").webcrypto,
    ensureCashDrawerReady: async () => true,
    buildPaymentInstrument: () => null,
    OrderApis: { addPayment: () => "/payments", getOrderBill: () => "/bill" },
    PaymentApis: { fonepayStatus: () => "/fonepay/status" },
    apiClient: {
      post: async () => { throw new Error("Network failure"); },
      get: async () => ({ data: { data: { balance_due: 100, total_paid: 0 } } }),
    },
    fetchBill: async () => {}, fetchContext: async () => {}, fetchCustomers: async () => {},
    fonepayPrn: "test-prn", fonepayVerifying: false, user: { restaurant_id: 1 },
    setPayError: (value) => { state.error = value; },
    setPaymentOpen: (value) => { state.open = value; },
    setShouldAutoRedirectAfterPayment: (value) => { state.redirect = value; },
    toast: { success() {}, error(message) { assert.fail(message); } },
  };
  for (const name of [
    "setPaySubmitting", "setMultiPayments", "setIsMultiPayment", "setPayAmount",
    "setPayReference", "setPayMethod", "setFonepayVerifying", "setFonepayStatus",
    "setFonepayDialogOpen", "setFonepayPrn", "setFonepayQr", "setFonepayPayloadText",
  ]) bindings[name] = () => {};
  Object.assign(bindings, overrides);
  const handlers = loadFunctions("app/(dashboard)/orders/[id]/checkout/page.tsx", [
    "paymentAttemptKey", "clearPaymentAttempt", "submitPayment",
    "handleAddPayment", "handleVerifyFonepay",
  ], bindings);
  return { ...handlers, bindings, state };
}

test("single-payment retries reuse a key and successful attempts clear it", async () => {
  const page = checkout();
  const keys = [];
  page.bindings.apiClient.post = async (_, payload) => {
    keys.push(payload.idempotency_key);
    if (keys.length === 1) throw new Error("Response lost");
    return { data: { data: { payment_complete: true } } };
  };
  await page.handleAddPayment();
  await page.handleAddPayment();
  assert.ok(keys[0]);
  assert.equal(keys[0], keys[1]);
  assert.equal(page.bindings.paymentAttemptRef.current, null);
  assert.equal(page.state.redirect, true);
  assert.notEqual(page.paymentAttemptKey("new-payment"), keys[0]);
});

test("overlapping submissions only post one payment", async () => {
  const page = checkout();
  let release;
  let posts = 0;
  page.bindings.apiClient.post = () => {
    posts += 1;
    return new Promise((resolve) => { release = resolve; });
  };
  const first = page.handleAddPayment();
  await Promise.resolve();
  await page.handleAddPayment();
  assert.equal(posts, 1);
  release({ data: { data: { payment_complete: true } } });
  await first;
  assert.equal(page.bindings.paymentSubmissionRef.current, false);
});

test("partially saved rows keep the dialog open and reuse row keys on retry", async () => {
  const page = checkout({ isMultiPayment: true });
  const keys = [];
  page.bindings.apiClient.post = async (_, payload) => {
    keys.push(payload.idempotency_key);
    if (keys.length === 2) throw new Error("Second row failed");
    return { data: { data: {} } };
  };
  page.bindings.apiClient.get = async () => ({
    data: { data: { total_paid: 40, balance_due: 60, payment_complete: false } },
  });
  await page.handleAddPayment();
  assert.equal(page.state.open, true);
  assert.equal(page.state.redirect, false);
  assert.match(page.state.error, /Some payment rows were saved/);
  await page.handleAddPayment();
  assert.equal(keys[0], keys[2]);
  assert.equal(keys[1], keys[3]);
  assert.notEqual(keys[0], keys[1]);
  assert.equal(page.state.open, false);
});

test("Fonepay verification refreshes the bill without posting another payment", async () => {
  const page = checkout();
  let refreshes = 0;
  page.bindings.apiClient.get = async () => ({ data: { data: { status: "success" } } });
  page.bindings.apiClient.post = async () => assert.fail("Duplicate provider payment");
  page.bindings.fetchBill = async () => { refreshes += 1; };
  await page.handleVerifyFonepay();
  assert.equal(refreshes, 1);
  assert.equal(page.state.redirect, true);
});

test("OAuth popups keep their session and isolation without the application preload", () => {
  let handler;
  const externalUrls = [];
  const oauth = loadFunctions("main.js", [
    "sanitizeUserAgent", "isOAuthPopupUrl", "attachOAuthPopupHandler",
  ], {
    URL, PERSIST_PARTITION: "persist:yummy-pos",
    getLiveMainWindow: () => null,
    getStartUrl: () => "https://app.yummyever.com",
    shell: { openExternal: (url) => externalUrls.push(url) },
  });
  oauth.attachOAuthPopupHandler({
    isDestroyed: () => false,
    setWindowOpenHandler: (callback) => { handler = callback; },
  });
  const popup = handler({ url: "https://accounts.google.com/o/oauth2/auth" });
  assert.equal(popup.action, "allow");
  const prefs = popup.overrideBrowserWindowOptions.webPreferences;
  assert.equal(prefs.partition, "persist:yummy-pos");
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.preload, undefined);
  assert.equal(handler({ url: "https://example.com" }).action, "deny");
  assert.deepEqual(externalUrls, ["https://example.com"]);
  assert.equal(oauth.sanitizeUserAgent("Mozilla/5.0 Electron/41.7.1 Chrome/146"), "Mozilla/5.0 Chrome/146");
});
