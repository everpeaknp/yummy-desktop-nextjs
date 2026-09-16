const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Wave 4 records the Kitchen route as the dedicated KOT ticket queue", () => {
  const migration = read("docs/WEB_UI_SYSTEM_MIGRATION.md");

  assert.match(migration, /\| Wave 4\s+\| Kitchen \/ KOT operational family/);
  assert.match(
    migration,
    /`\/kitchen`[\s\S]*Kitchen operations[\s\S]*FOUNDATION-COMPLIANT[\s\S]*\| 4/,
  );
  assert.match(migration, /Reusable ticket family; preserve lifecycle/);
});

test("Kitchen preserves queue state, filtering, and live-update ownership", () => {
  const kitchen = read("app/(dashboard)/kitchen/page.tsx");

  assert.match(kitchen, /KotApis\.searchKots/);
  assert.match(kitchen, /new WebSocket\(url\)/);
  assert.match(
    kitchen,
    /setInterval\(\(\) => \{[\s\S]*doFetch\(restaurantId\)[\s\S]*\}, 15000\)/,
  );
  assert.match(kitchen, /case "PENDING":\s*return "PREPARING"/);
  assert.match(kitchen, /case "PREPARING":\s*return "READY"/);
  assert.match(kitchen, /case "READY":\s*return "SERVED"/);
  assert.match(kitchen, /<PageTabs[\s\S]*ariaLabel="Kitchen station"/);
  assert.match(kitchen, /<select[\s\S]*aria-label="Kitchen station"/);
  assert.match(kitchen, /<FilterChip[\s\S]*count=\{total\}[\s\S]*All/);
  assert.match(kitchen, /overflow-x-auto overscroll-x-contain/);
  assert.match(kitchen, /scroll-px-4[\s\S]*pr-4/);
  assert.match(kitchen, /<KitchenTicketCard/);
  assert.match(kitchen, /pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(kitchen, /grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3/);
  assert.doesNotMatch(kitchen, /2xl:grid-cols-4/);
});

test("KOT card family provides shared board, compact, and embedded ticket variants", () => {
  const card = read("components/kitchen/kot-ticket-card.tsx");

  assert.match(card, /export function KOTTicketCard/);
  assert.match(card, /export function KotCompactTicketCard/);
  assert.match(card, /export function KotEmbeddedTicketCard/);
  assert.match(card, /export function KotTicketHeader/);
  assert.match(card, /export function KotTicketItemList/);
  assert.match(card, /KOT #\{ticket\.kot_number/);
  assert.match(card, /displayedItems\.map\(/);
  assert.match(card, /modifier\.modifier_name_snapshot/);
  assert.match(card, /NOTE/);
  assert.match(card, /KotTicketStatusBadge/);
  assert.match(card, /elapsed >= 20 \* 60 \* 1000/);
  assert.match(card, /className="h-11 px-4 font-semibold"/);
  assert.match(card, /className="h-11 px-3 text-destructive/);
  assert.match(card, /export function kotTypeLabel/);
  assert.match(card, /case "INITIAL":\s*return "Initial ticket"/);
  assert.match(card, /case "ADD":\s*return "Additional items"/);
  assert.match(
    card,
    /ticket\.table_name \|\| ticket\.customer_name \|\| kotTypeLabel\(ticket\.type\)/,
  );
  assert.doesNotMatch(card, /\|\| ticket\.type;/);
});

test("Orders and Order Detail render compact shared KOT variants", () => {
  const orders = read("app/(dashboard)/orders/page.tsx");
  const orderDetail = read("app/(dashboard)/orders/[id]/page.tsx");
  const card = read("components/kitchen/kot-ticket-card.tsx");

  assert.match(orders, /<KotCompactTicketCard kot=\{kot\}/);
  assert.match(orderDetail, /<KotEmbeddedTicketCard/);
  assert.match(orderDetail, /primaryAction=/);
  assert.match(orderDetail, /onReject=/);
  assert.match(card, /className="h-11 min-w-0 flex-1 font-semibold"/);
  assert.match(
    card,
    /variant="ghost"[\s\S]*aria-label="Reject kitchen ticket"/,
  );
  assert.match(card, /!isTerminal && onReject/);
  assert.doesNotMatch(card, /h-11 w-full border-destructive/);
});

test("Kitchen status chips keep complete labels within their own scrollable tabs", () => {
  const filterChip = read("components/patterns/controls/filter-chip.tsx");

  assert.match(filterChip, /min-h-11/);
  assert.match(filterChip, /shrink-0 max-w-none/);
  assert.match(filterChip, /whitespace-nowrap/);
  assert.doesNotMatch(filterChip, /truncate|text-ellipsis/);
});

test("KOT detail dialogs use mobile-safe vertical layout and humanized activity", () => {
  const kitchen = read("app/(dashboard)/kitchen/page.tsx");
  const orders = read("app/(dashboard)/orders/page.tsx");
  const card = read("components/kitchen/kot-ticket-card.tsx");

  for (const source of [kitchen, orders]) {
    assert.match(source, /h-\[100dvh\] w-full max-w-none min-w-0 flex-col/);
    assert.match(source, /overflow-y-auto overscroll-contain/);
    assert.match(source, /formatDateTime\(/);
  }
  assert.match(kitchen, /humanizeKotEvent/);
  assert.match(orders, /humanizeKotEvent/);
  assert.match(card, /"kot\.created": "Ticket created"/);
  assert.match(card, /"kot\.status_changed": "Ticket status changed"/);
});
