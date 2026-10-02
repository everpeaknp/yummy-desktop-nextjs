const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("day close route owns one canonical operational flow", () => {
  const page = read("app/(dashboard)/day-close/page.tsx");
  const analytics = read("app/(dashboard)/analytics/page.tsx");
  const history = read("components/analytics/day-close-history.tsx");

  assert.match(page, /<DayCloseFlow/);
  assert.doesNotMatch(page, /DayCloseModal/);
  assert.match(analytics, /href=\{`\/day-close\?business_line=/);
  assert.doesNotMatch(analytics, /DayCloseModal|setIsDayCloseOpen/);
  assert.match(
    history,
    /router\.push\(`\/day-close\?\$\{params\.toString\(\)\}`\)/,
  );
  assert.doesNotMatch(history, /DayCloseModal|wizardOpen/);
});

test("mobile flow presents review blockers readiness warnings and compact totals", () => {
  const flow = read("components/day-close/day-close-flow.tsx");

  for (const token of [
    '"orders"',
    '"payments"',
    '"refunds"',
    '"cash"',
    '"accounting"',
    "Needs attention",
    "Review suggested",
    "Readiness",
    "Financial summary",
    "FinancialDetailsButton",
    "Includes activity since the previous confirmed close.",
    "Resolve the blockers above to continue.",
  ]) {
    assert.match(
      flow,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.match(
    flow,
    /presentation\.blockers\.length \|\| !presentation\.canContinue/,
  );
  assert.doesNotMatch(
    flow,
    /<table|<Table|DaybookReport|DayCloseSnapshotPanel/,
  );
});

test("readiness uses operational domains and cash variance context", () => {
  const flow = read("components/day-close/day-close-flow.tsx");
  const presentation = read("lib/presentation/day-close.ts");

  assert.match(presentation, /orders: DAY_CLOSE_TERMS\.orders/);
  assert.match(presentation, /active_orders_count/);
  assert.match(presentation, /to finish/);
  assert.match(presentation, /Ready · variance approved/);
  assert.match(presentation, /Review cash difference/);
  assert.match(flow, /DAY_CLOSE_TERMS\.cashDifference/);
  assert.doesNotMatch(flow, /const READINESS_ORDER[\s\S]*?"sales"/);
});

test("financial details separate credit activity from close balance", () => {
  const details = read("components/day-close/day-close-financial-details.tsx");

  assert.match(details, /Credit — this period/);
  assert.match(details, /label="Credit sales"/);
  assert.match(details, /label="Credit collected"/);
  assert.match(details, /Balance at close/);
  assert.match(details, /label="Outstanding receivables"/);
  assert.match(details, /Income recognized/);
  assert.match(details, /label="Other income"/);
  assert.match(details, /label="Total income"/);
  assert.match(details, /Costs recognized/);
  assert.match(details, /label="Cost of goods sold"/);
  assert.match(details, /label="Other recognized expenses"/);
  assert.match(details, /Money paid out/);
  assert.match(details, /label="Inventory purchases paid"/);
  assert.match(details, /label="Supplier bills paid"/);
  assert.match(details, /Purchasing and suppliers/);
  assert.match(details, /label="Purchase returns"/);
  assert.match(details, /label="Refunds received from suppliers"/);
  assert.match(details, /label="Supplier credits received"/);
  assert.doesNotMatch(details, /<h3 className="font-semibold">Outflows<\/h3>/);
  assert.doesNotMatch(details, /\.reduce\(/);
});

test("financial details expose backend-owned account movements", () => {
  const details = read("components/day-close/day-close-financial-details.tsx");
  const types = read("types/day-close.ts");

  assert.match(details, /Accounting movements/);
  assert.match(details, /Opening/);
  assert.match(details, /Debit/);
  assert.match(details, /Credit/);
  assert.match(details, /Closing/);
  assert.match(details, /account_movements_complete/);
  assert.match(details, /Accounting movements unavailable/);
  assert.match(details, /\/finance\/reports\/account-ledger\?/);
  assert.match(types, /interface DayCloseAccountMovement/);
  assert.doesNotMatch(details, /period_debit\s*[-+]\s*movement\.period_credit/);
});

test("cash step preserves backend authority and focused drawer work", () => {
  const flow = read("components/day-close/day-close-flow.tsx");
  const presentation = read("lib/presentation/day-close.ts");
  const source = `${flow}\n${presentation}`;

  for (const token of [
    "Cash the system expects",
    "Cash counted",
    "Not counted",
    "Manually counted",
    "drawer_evidence",
    "manual_count",
    "not_counted",
    "Review cash difference",
    "Choose where the cash goes",
    "Review close",
    "DrawerSessionPanel",
    'presentation="flat"',
  ]) {
    assert.match(
      source,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.match(flow, /latest\.drawer_control\?\.counted_cash/);
  assert.match(flow, /latest\.expected_cash/);
  assert.doesNotMatch(flow, /expectedCash\s*=\s*.*cash_sales/);
});

test("final review completion and permissions use plain operational language", () => {
  const flow = read("components/day-close/day-close-flow.tsx");

  for (const token of [
    "Activity included",
    "Closing note",
    "Optional",
    "Close day",
    "Closing day…",
    "Ready for an authorized manager to close.",
    "Day closed",
    "Closed by",
    "Closed at",
    "View close details",
    "View in Analytics",
    "Return to dashboard",
  ]) {
    assert.match(
      flow,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.doesNotMatch(
    flow,
    /permanently locked|finance event|journal|suspense|trial balance/i,
  );
  assert.match(flow, /pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(flow, /max-w-3xl/);
});

test("confirmation conflicts refresh readiness and cannot leave a stale close action", () => {
  const flow = read("components/day-close/day-close-flow.tsx");

  assert.match(flow, /await load\(\);\s*setStep\("review"\)/);
  assert.match(flow, /ACCOUNTING_REVIEW_REQUIRED/);
  assert.match(flow, /can_close: false/);
  assert.match(flow, /Financial records are still being prepared/);
});

test("posting failures remain system-owned in the operational Day Close", () => {
  const flow = read("components/day-close/day-close-flow.tsx");
  const confirmed = read("components/day-close/day-close-confirmed-detail.tsx");
  const presentation = read("lib/presentation/day-close.ts");
  const review = read("app/(dashboard)/day-close/finance-review/page.tsx");
  const accountingLayout = read(
    "app/(dashboard)/finance/accounting/layout.tsx",
  );

  assert.doesNotMatch(
    presentation,
    /actionHref: "\/day-close\/finance-review"/,
  );
  assert.doesNotMatch(flow, /getAccountingReviewUrlForDayClose/);
  assert.match(flow, /Closing is temporarily unavailable/);
  assert.match(flow, /system could not finish preparing the financial records/);
  assert.doesNotMatch(confirmed, /Open finance review|Finance check/);
  assert.match(review, /finance\.accounting\.periods\.close/);
  assert.match(review, /Finance administrator access required/);
  assert.match(review, /Why closing is blocked/);
  assert.match(review, /What needs attention/);
  assert.match(review, /How to resolve it/);
  assert.match(review, /unposted-events/);
  assert.match(review, /could not be added.*automatically/s);
  assert.doesNotMatch(review, /Migrate missing entries/);
  assert.doesNotMatch(review, /postDayCloseMissingEvents/);
  assert.doesNotMatch(review, /finance\.ledger\.backfill/);
  assert.match(review, /suspense-postings/);
  assert.match(review, /trial-balance-difference/);
  assert.match(review, /Run check again/);
  assert.match(review, /Return to Day close/);
  assert.doesNotMatch(review, /<Table|AccountingNav|dashboard card/i);
  assert.match(accountingLayout, /redirect\("\/finance\/operations"\)/);
});
