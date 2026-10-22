const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Tables keeps the approved spatial layout and edit persistence mechanics", () => {
  const tables = read("app/(dashboard)/tables/page.tsx");
  const roomContainer = read("components/tables/room-container.tsx");

  assert.match(tables, /<RoomContainer/);
  assert.match(tables, /isLayoutMode/);
  assert.match(tables, /onTableDrop=\{isLayoutMode \? handleTableDrop/);
  assert.match(tables, /onTableResize=\{isLayoutMode \? handleTableResize/);
  assert.match(tables, /TableApis\.updateTable\(table\.id\)/);
  assert.match(roomContainer, /draggable=\{isLayoutMode\}/);
  assert.match(
    roomContainer,
    /onTableDrop\?\.\(dragTableId\.current, percX, percY\)/,
  );
  assert.match(roomContainer, /onTableResize\(table\.id, width, height\)/);
});

test("Reservations uses responsive register rows while retaining its booking detail and form workflows", () => {
  const reservations = read("app/(dashboard)/reservations/page.tsx");

  assert.match(reservations, /<DataList className="lg:hidden">/);
  assert.match(reservations, /<DataList className="hidden lg:block">/);
  assert.match(reservations, /<ReservationForm/);
  assert.match(reservations, /<ReservationDetailsSheet/);
  assert.match(reservations, /ReservationApis\.listReservations/);
  assert.doesNotMatch(reservations, /xl:grid-cols-3/);
});

test("Receipt History uses configured currency and the canonical fiscal sale detail", () => {
  const receipts = read("app/(dashboard)/receipts/page.tsx");
  const detail = read("components/receipts/receipt-detail-sheet.tsx");

  assert.match(receipts, /formatCurrency\(amount, restaurant\?\.currency\)/);
  assert.match(receipts, /<DataList className="md:hidden">/);
  assert.match(receipts, /<DataList className="hidden md:block">/);
  assert.doesNotMatch(receipts, /Rs\./);
  assert.match(detail, /SalesDocumentDetailSheet/);
});

test("Services remains navigation grouping rather than an invented workspace", () => {
  const sidebarItems = read("hooks/use-sidebar-items.ts");
  const servicesRoute = path.join(
    root,
    "app",
    "(dashboard)",
    "services",
    "page.tsx",
  );

  assert.match(sidebarItems, /getGroup\(\s*"services",\s*"Services"/);
  assert.equal(fs.existsSync(servicesRoute), false);
});
