const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("supplier and customer workspaces use a flat entity-workspace composition without changing domain logic", () => {
  const supplier = read(
    "components/manage/suppliers/supplier-detail-workspace.tsx",
  );
  const customer = read("components/customers/customer-detail-workspace.tsx");
  const partyActivityRow = read(
    "components/finance/party-workspace/party-activity-row.tsx",
  );

  for (const workspace of [supplier, customer]) {
    assert.match(workspace, /max-w-\[1600px\]/);
    assert.match(workspace, /pb-24/);
    assert.match(workspace, /function Metric/);
    assert.match(workspace, /Financial summary/);
    assert.match(workspace, /Current balance/);
    assert.match(workspace, /Details/);
    assert.match(workspace, /Quick access/);
    assert.match(workspace, /overflow-hidden rounded-xl border bg-card/);
    assert.match(workspace, /overflow-x-auto/);
    assert.match(workspace, /PartyActivityRow/);
    assert.match(
      workspace,
      /grid grid-cols-\[minmax\(0,1fr\)_auto\] gap-2 lg:flex lg:flex-wrap lg:justify-end/,
    );
    assert.match(workspace, /col-span-full h-12 w-full justify-center/);
    assert.match(workspace, /h-12 w-12 shrink-0 lg:h-11 lg:w-11/);
    assert.doesNotMatch(workspace, /<span>More<\/span>/);
    assert.match(workspace, /More .* actions/);
    assert.match(workspace, /DropdownMenuContent align="end"/);
    assert.match(workspace, /Open-item statement/);
    assert.match(workspace, /RefreshCw/);
    assert.doesNotMatch(workspace, /Customer workspace|Supplier workspace/);
    assert.doesNotMatch(workspace, /ArrowLeft/);
    assert.doesNotMatch(workspace, /grid gap-4 lg:grid-cols-\[300px_1fr\]/);
  }

  assert.match(supplier, /PartyLedgerApis\.statement\([\s\S]*"supplier"/);
  assert.match(customer, /PartyLedgerApis\.statement\([\s\S]*"customer"/);
  assert.match(supplier, /PurchaseApis\.list/);
  assert.match(customer, /financeSalesApi\.list/);
  assert.match(customer, /document\.document_kind === "credit_note"/);
  assert.match(customer, /salesReturnDetail\(document\)/);
  assert.match(customer, /CustomerInvoiceRegister/);
  assert.match(customer, /CustomerReturnRegister/);
  assert.match(customer, /CustomerPaymentRegister/);
  assert.match(supplier, /SupplierBillRegister/);
  assert.match(supplier, /SupplierReturnRegister/);
  assert.match(supplier, /Promise\.allSettled/);
  assert.doesNotMatch(supplier, /await Promise\.all\(/);
  assert.match(
    supplier,
    /Some supplier records could not be loaded\. Supplier details remain available\./,
  );
  assert.match(supplier, /SupplierPaymentRegister/);
  assert.match(partyActivityRow, /grid-cols-\[1\.25rem_minmax\(0,1fr\)_minmax/);
  assert.match(partyActivityRow, /tabular-nums/);
  assert.match(partyActivityRow, /text-foreground/);
  assert.doesNotMatch(partyActivityRow, /text-(emerald|orange|red)-/);
});

test("party registers use canonical routes, configured currency, and responsive list anatomy", () => {
  const suppliersRoute = read("app/(dashboard)/suppliers/page.tsx");
  const suppliersAliasRoute = read("app/(dashboard)/manage/suppliers/page.tsx");
  const supplierDetailRoute = read(
    "app/(dashboard)/suppliers/[supplierId]/page.tsx",
  );
  const customersRoute = read("app/(dashboard)/customers/page.tsx");
  const customerDetailRoute = read(
    "app/(dashboard)/customers/[customerId]/page.tsx",
  );
  const suppliers = read("components/manage/suppliers/suppliers-workspace.tsx");

  assert.match(suppliersRoute, /showBackToManage=\{false\}/);
  assert.match(suppliersAliasRoute, /redirect\("\/suppliers"\)/);
  assert.match(
    supplierDetailRoute,
    /SupplierDetailWorkspace supplierId=\{id\}/,
  );
  assert.match(customerDetailRoute, /CustomerDetailWorkspace customerId=/);

  assert.match(customersRoute, /useRestaurant/);
  assert.match(
    customersRoute,
    /formatCurrency\(totalReceivable, restaurant\?\.currency\)/,
  );
  assert.match(customersRoute, /label="Total receivable"/);
  assert.match(customersRoute, /presentCustomerBalance/);
  assert.match(customersRoute, /<DataList className="lg:hidden">/);
  assert.match(customersRoute, /<DataList className="hidden lg:block">/);
  assert.match(customersRoute, /CustomerApis\.listCustomers/);
  assert.match(customersRoute, /OrderApis\.listOrders/);
  assert.match(customersRoute, /status === 403/);
  assert.doesNotMatch(customersRoute, /OperationalCard/);
  assert.doesNotMatch(customersRoute, /Rs\.\s*\{/);
  assert.doesNotMatch(customersRoute, /Customer credit \$\{formatCurrency/);

  assert.match(suppliers, /<DataList className="lg:hidden">/);
  assert.match(
    suppliers,
    /hidden overflow-x-auto rounded-2xl border border-border bg-card lg:block/,
  );
  assert.match(suppliers, /formatCurrency\(supplier\.payable_amount\)/);
  assert.match(suppliers, /router\.push\(`\/suppliers\/\$\{supplier\.id\}`\)/);
});

test("customer balance presentation follows statement semantics without inferring credit from a signless list field", () => {
  const balance = read("lib/presentation/customer-balance.ts");
  const navigation = read("lib/mobile-module-navigation.ts");

  assert.match(
    balance,
    /`net_open` is the authoritative party-statement balance/,
  );
  assert.match(balance, /kind: "receivable"/);
  assert.match(balance, /label: "Receivable"/);
  assert.match(balance, /kind: "customer-credit"/);
  assert.match(balance, /label: "Customer credit"/);
  assert.match(balance, /kind: "settled"/);
  assert.match(balance, /label: "Settled"/);
  assert.match(balance, /label: "Balance unavailable"/);
  assert.match(balance, /legacyReceivable > BALANCE_EPSILON/);
  assert.match(
    balance,
    /return \{ kind: "unavailable", amount: null, label: "Balance unavailable" \};/,
  );

  assert.match(
    navigation,
    /\["\/customers", "Customers", "secondary", "\/manage"\]/,
  );
  assert.match(
    navigation,
    /\["\/suppliers", "Suppliers", "secondary", "\/manage"\]/,
  );
});
