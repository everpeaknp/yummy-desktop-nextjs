const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Wave 3 records the Orders operational family and its protected patterns", () => {
  const migration = read("docs/WEB_UI_SYSTEM_MIGRATION.md");

  assert.match(
    migration,
    /`\/orders`, `\/orders\/history`, `\/orders\/\[id\]`/,
  );
  assert.match(
    migration,
    /Orders, Order History, Order Detail and Quick Bill[\s\S]*APPROVED/,
  );
  assert.match(migration, /mobile New Order control\/animation/);
  assert.match(
    migration,
    /KOT cards remain[\s\S]*protected domain-specific patterns/,
  );
});

test("Orders keeps its domain cards and mobile New Order interaction while using responsive controls", () => {
  const page = read("app/(dashboard)/orders/page.tsx");
  const newOrder = read("components/orders/orders-new-order-sheet.tsx");

  assert.match(page, /<OrderCard order=\{order\}/);
  assert.match(page, /<OrderHistoryCard[\s\S]*order=\{order\}/);
  assert.match(page, /<OrdersNewOrderSheet \/>/);
  assert.match(page, /grid-cols-1 gap-3 sm:grid-cols-2/);
  assert.match(page, /className="shrink-0 lg:hidden"/);
  assert.match(page, /FilterBar className="hidden lg:block"/);
  assert.match(
    page,
    /pb-\[calc\(9rem\+env\(safe-area-inset-bottom\)\)\] lg:pb-10/,
  );
  assert.match(page, /Completed and historical orders for review\./);
  assert.match(newOrder, /orders-new-order-cta fixed/);
  assert.match(newOrder, /new-order-sheet-motion/);
});

test("KOT status chips and station/table filters use a consistent control style", () => {
  const page = read("app/(dashboard)/orders/page.tsx");
  const kotFilters = page.match(
    /\{activeTab === "kot" && \([\s\S]*?\n          \)\}/,
  )?.[0];

  assert.ok(kotFilters, "KOT filter controls should exist");
  assert.match(kotFilters, /className=\{cn\([\s\S]*rounded-xl/);
  assert.match(kotFilters, /bg-primary\/10 text-primary/);
  assert.match(kotFilters, /<SelectTrigger[\s\S]*h-11[\s\S]*rounded-xl/);
  assert.match(kotFilters, /aria-label="Filter kitchen station"/);
  assert.match(kotFilters, /aria-label="Filter table"/);
  assert.doesNotMatch(kotFilters, /<select\b/);
});

test("Orders tabs use a visibly accented active state", () => {
  const page = read("app/(dashboard)/orders/page.tsx");
  const pageTabs = read("components/patterns/navigation/page-tabs.tsx");

  assert.match(page, /<PageTabs[\s\S]*?activeVariant="accent"/);
  assert.match(pageTabs, /activeVariant\?: "default" \| "accent"/);
  assert.match(pageTabs, /data-\[state=active\]:bg-primary\/10/);
  assert.match(pageTabs, /data-\[state=active\]:text-primary/);
  assert.match(pageTabs, /data-\[state=active\]:ring-1/);
});

test("Order detail sections give the selected tab a clear orange accent", () => {
  const page = read("app/(dashboard)/orders/[id]/page.tsx");
  const tabBar = page.match(
    /aria-label="Order detail sections"([\s\S]*?)<\/nav>/,
  )?.[1];

  assert.ok(tabBar, "Order detail tab bar should exist");
  assert.match(tabBar, /activeTab === tab\.key[\s\S]*bg-primary\/10/);
  assert.match(tabBar, /text-primary[\s\S]*ring-1[\s\S]*ring-primary\/30/);
  assert.match(tabBar, /: "text-muted-foreground hover:text-foreground"/);
});

test("Serving a KOT reconciles its item progress from the server response", () => {
  const page = read("app/(dashboard)/orders/[id]/page.tsx");
  const statusHandler = page.match(
    /const handleKotStatusChange = useCallback\(([\s\S]*?)\n  const handleKotReject/,
  )?.[1];

  assert.ok(statusHandler, "KOT status handler should exist");
  assert.match(statusHandler, /apiClient\.patch\(\s*KotApis\.updateKotStatus\(kotId\)/);
  assert.match(statusHandler, /const updatedKot = response\.data\?\.data/);
  assert.match(statusHandler, /Number\(updatedKot\.id\) === kotId/);
  assert.match(statusHandler, /updateKotLocal\(kotId, updatedKot\)/);
});

test("Order detail marks only the KOT with an in-flight action as updating", () => {
  const page = read("app/(dashboard)/orders/[id]/page.tsx");
  const kotsTab = page.match(/function KOTsTab\([\s\S]*?(?=\n\/\/ ── Events Tab)/)?.[0];

  assert.match(page, /const \[kotUpdatingIds, setKotUpdatingIds\] = useState<Set<number>>\(new Set\(\)\)/);
  assert.match(kotsTab || "", /const isUpdating = Boolean\(updatingKotIds\?\.has\(kot\.id\)\)/);
  assert.match(kotsTab || "", /isUpdating=\{isUpdating\}/);
  assert.doesNotMatch(kotsTab || "", /updatingKotId && updatingKotId !== kot\.id/);
});

test("History date fields align their labels with the shortcut controls", () => {
  const page = read("app/(dashboard)/orders/page.tsx");
  const historyFilters = page.match(
    /\{activeTab === "history" && \([\s\S]*?\n          \)\}/,
  )?.[0];
  const dateFilter = page.match(
    /function HistoryDateFilter\([\s\S]*?(?=\nfunction OrderDetailFilterFields)/,
  )?.[0];

  assert.ok(historyFilters, "History filter controls should exist");
  assert.ok(dateFilter, "History date picker should exist");
  assert.match(historyFilters, /<HistoryDateFilter[\s\S]*label="From"/);
  assert.match(historyFilters, /<HistoryDateFilter[\s\S]*label="To"/);
  assert.match(dateFilter, /h-11 w-\[216px\] shrink-0/);
  assert.match(dateFilter, /aria-label=\{`\$\{label\} date`\}/);
  assert.match(page, /from "@\/components\/ui\/calendar"/);
  assert.match(dateFilter, /<CalendarComponent[\s\S]*mode="single"/);
  assert.doesNotMatch(dateFilter, /type="date"/);
  assert.doesNotMatch(dateFilter, /grid gap-1 text-xs text-muted-foreground/);
});

test("Order history requests real server pages and shows page navigation", () => {
  const page = read("app/(dashboard)/orders/page.tsx");

  assert.match(page, /const HISTORY_PAGE_SIZE = 50/);
  assert.match(page, /skip:\s*\(historyPage - 1\) \* HISTORY_PAGE_SIZE/);
  assert.match(page, /limit:\s*HISTORY_PAGE_SIZE/);
  assert.match(page, /setHistoryTotal\(Number\(data\.total/);
  assert.match(page, /Previous/);
  assert.match(page, /Next/);
  assert.doesNotMatch(page, /IntersectionObserver/);
});

test("Resetting order history clears its filters and returns to the first page", () => {
  const page = read("app/(dashboard)/orders/page.tsx");

  assert.match(page, /const resetHistoryFilters = useCallback/);
  assert.match(page, /setSearchQuery\(""\)/);
  assert.match(page, /setHistoryDetailFilters\(emptyOrderDetailFilters\)/);
  assert.match(page, /setHistoryPage\(1\)/);
  assert.match(page, /onClick=\{resetHistoryFilters\}/);
});

test("Order history payment status is sent to the paginated API and filterable on mobile and desktop", () => {
  const page = read("app/(dashboard)/orders/page.tsx");

  assert.match(page, /historyPaymentStatus/);
  assert.match(page, /params\.payment_status = historyPaymentStatus/);
  assert.match(page, /Payment status/);
  assert.match(page, /Partially paid/);
  assert.match(page, /setHistoryPaymentStatus\("all"\)/);
  assert.match(page, /setHistoryPage\(1\)/);
});

test("Desktop order history payment filter aligns inline with date controls", () => {
  const page = read("app/(dashboard)/orders/page.tsx");
  const historyFilters = page.match(
    /<FilterBar className="hidden lg:block" title="History filters">([\s\S]*?)<\/FilterBar>/,
  )?.[1];

  assert.ok(historyFilters, "History filter row should exist");
  assert.match(
    historyFilters,
    /<SelectTrigger[\s\S]*?h-11[\s\S]*?<span className="text-xs text-muted-foreground">Payment<\/span>[\s\S]*?<SelectValue/,
  );
  assert.doesNotMatch(historyFilters, /Payment status<\/label>/);
  assert.doesNotMatch(historyFilters, /Extended history/);
});

test("Order history ignores stale responses after its filters change", () => {
  const page = read("app/(dashboard)/orders/page.tsx");

  assert.match(page, /const historyRequestId = useRef\(0\)/);
  assert.match(page, /fetchHistoryData\(requestId\)/);
  assert.match(page, /if \(requestId !== historyRequestId\.current\) return/);
  assert.match(
    page,
    /if \(requestId === historyRequestId\.current\) setHistoryLoading\(false\)/,
  );
});

test("Order history shows fetched cards without waiting for settlement enrichment", () => {
  const page = read("app/(dashboard)/orders/page.tsx");
  const historyFetch = page.match(
    /const fetchHistoryData = useCallback\(async \(requestId: number\) => \{([\s\S]*?)\n  \}, \[/,
  )?.[1];

  assert.ok(historyFetch, "History fetch callback should exist");
  const ordersIndex = historyFetch.indexOf("setHistoryOrders(list)");
  const loadingIndex = historyFetch.indexOf(
    "setHistoryLoading(false)",
    ordersIndex,
  );
  assert.ok(
    ordersIndex >= 0 &&
      loadingIndex > ordersIndex &&
      loadingIndex < historyFetch.indexOf("financeSalesApi.getOrderSettlements("),
    "History cards should become visible before optional settlement summaries load",
  );
});

test("Orders money, receipt access, and operational detail hierarchy remain intact", () => {
  const activeCard = read("components/orders/order-card.tsx");
  const historyCard = read("components/orders/order-history-card.tsx");
  const detail = read("app/(dashboard)/orders/[id]/page.tsx");
  const quickBill = read("components/orders/pos-system.tsx");
  const customisation = read("components/orders/item-customization-dialog.tsx");

  assert.match(activeCard, /formatCurrency\(order\.grand_total, currency\)/);
  assert.match(historyCard, /formatCurrency\(order\.grand_total, currency\)/);
  assert.doesNotMatch(activeCard, /\|\| "Rs\."/);
  assert.doesNotMatch(historyCard, /\|\| "Rs\."/);
  assert.match(detail, /formatProductCurrency\(amount\)/);
  assert.match(
    detail,
    /const statusConfig = getStatusConfig\(displayOrder\.status\)/,
  );
  assert.match(detail, /\{statusConfig\.label\}/);
  assert.match(detail, /Menu prices\/subtotal are tax-inclusive/);
  assert.match(detail, /subtotal \+\s*Number\(sourceOrder\.service_charge/);
  assert.match(detail, /Tax included/);
  assert.doesNotMatch(detail, /Rs\./);
  assert.match(
    quickBill,
    /formatCurrency\(\s*getItemUnitPrice\(item\),\s*restaurant\?\.currency,?\s*\)/,
  );
  assert.match(
    quickBill,
    /itemCount: Array\.isArray\(items\) \? items\.length : 0/,
  );
  assert.match(quickBill, /\{cat\.name\} \(\{cat\.itemCount\}\)/);
  assert.match(
    quickBill,
    /pb-\[calc\(6rem\+env\(safe-area-inset-bottom\)\)\] lg:pb-8/,
  );
  assert.doesNotMatch(quickBill, /Rs\./);
  assert.doesNotMatch(customisation, /Rs\./);
  assert.match(detail, /href=\{`\/orders\/\$\{orderId\}\/receipt`\}/);
  assert.match(detail, /SalesDocumentDetailSheet/);
  assert.match(detail, /aria-label="More order actions"/);
});

test("POS loads selectable modifier options and lets every cart line carry a note", () => {
  const pos = read("components/orders/pos-system.tsx");
  const customisation = read("components/orders/item-customization-dialog.tsx");

  assert.match(pos, /ModifierApis\.listItemsByGroup\(group\.id\)/);
  assert.match(
    pos,
    /modifiers:\s+optionsResponse\.data\.status === "success"[\s\S]*\? optionsResponse\.data\.data/,
  );
  assert.match(pos, /onCustomizeItem: \(item: CartItem\) => void/);
  assert.match(pos, /\{item\.notes \|\| item\.modifiers\?\.length/);
  assert.match(pos, /: "Add note"/);
  assert.match(pos, /confirmLabel=.*"Save changes"/s);
  assert.match(customisation, /initialModifiers\?: any\[\]/);
  assert.match(customisation, /const EMPTY_MODIFIERS: any\[\] = \[\];/);
  assert.match(customisation, /initialModifiers = EMPTY_MODIFIERS/);
  assert.match(customisation, /initialNotes\?: string/);
  assert.match(
    customisation,
    /onConfirm\(item, flatModifiers, notes\.trim\(\)\)/,
  );
  assert.match(customisation, /modifier\.is_active !== false/);
});
