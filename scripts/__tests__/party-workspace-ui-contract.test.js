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
      /grid grid-cols-1 gap-2 min-\[360px\]:grid-cols-2 lg:flex/,
    );
    assert.match(workspace, /lg:h-11 lg:w-auto/);
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
  assert.match(supplier, /SupplierPaymentRegister/);
  assert.match(partyActivityRow, /grid-cols-\[1\.25rem_minmax\(0,1fr\)_minmax/);
  assert.match(partyActivityRow, /tabular-nums/);
});
