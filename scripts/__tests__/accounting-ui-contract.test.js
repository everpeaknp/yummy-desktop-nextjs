const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

test("accounting frontend exposes typed endpoint helpers", () => {
  assert.ok(exists("types/accounting.ts"), "types/accounting.ts should exist");
  const accountingTypes = read("types/accounting.ts");
  for (const token of [
    "AccountingPostResult",
    "AccountingDayClosePostingStatus",
    "AccountingDayClose",
    "AccountingHealthItem",
    "AccountingHealthResponse",
    "AccountingSettings",
    "AccountingSetupRun",
    "AccountingSetupStatus",
    "OpeningBalanceLine",
    "OpeningBalanceBatch",
    "OpeningBalanceLineInput",
    "OpeningBalanceBatchInput",
    "JournalVoucher",
    "JournalVoucherLine",
    "JournalVoucherLineInput",
    "JournalVoucherInput",
    "JournalVoucherUpdateInput",
    "JournalEntryReverseInput",
    "AccountingPeriod",
    "AccountingPeriodGenerateInput",
    "AccountingPeriodPreflight",
    "AccountingSeedAllDefaultsResult",
    "AccountingBackfillRequest",
    "AccountingBackfillRun",
    "CustomerLedgerRow",
    "CustomerLedgerResponse",
    "SupplierLedgerRow",
    "SupplierLedgerResponse",
    "CashFlowRow",
    "CashFlowResponse",
    "CashTransferInput",
    "CashTransferResult",
    "PaymentInstrument",
    "PaymentInstrumentInput",
    "TrialBalanceRow",
    "TrialBalanceResponse",
    "ChartAccount",
    "LedgerMapping",
  ]) {
    assert.match(accountingTypes, new RegExp(`export type ${token}\\b`));
  }

  const endpoints = read("lib/api/endpoints.ts");
  assert.match(endpoints, /export const AccountingApis\b/);
  assert.match(endpoints, /export const AccountingReportApis\b/);
  for (const helper of [
    "accounts",
    "mappings",
    "seedDefaults",
    "seedDefaultsAll",
    "health",
    "dayCloses",
    "dayClose",
    "dayClosePostingStatus",
    "postDayCloseMissingEvents",
    "softCloseDayClose",
    "setupStatus",
    "repairSetup",
    "openingBalances",
    "createOpeningBalance",
    "updateOpeningBalance",
    "postOpeningBalance",
    "reverseOpeningBalance",
    "journalVouchers",
    "createJournalVoucher",
    "updateJournalVoucher",
    "submitJournalVoucher",
    "approveJournalVoucher",
    "rejectJournalVoucher",
    "postJournalVoucher",
    "reverseJournalEntry",
    "periods",
    "generatePeriods",
    "periodPreflight",
    "softClosePeriod",
    "lockPeriod",
    "reopenPeriod",
    "backfillDryRun",
    "backfillCommit",
    "backfillRuns",
    "trialBalance",
    "profitLoss",
    "balanceSheet",
    "generalLedger",
    "vatSummary",
    "customerLedger",
    "supplierLedger",
    "cashFlow",
    "createCashTransfer",
    "paymentInstruments",
    "createPaymentInstrument",
    "updatePaymentInstrument",
    "mappingExceptions",
  ]) {
    assert.match(endpoints, new RegExp(`\\b${helper}:`));
  }
});

test("accounting reports expose source drilldown and trace workflow", () => {
  const accountingTypes = read("types/accounting.ts");
  for (const token of [
    "AccountingDrilldownLine",
    "AccountingDrilldownResponse",
    "AccountingSourceTraceEvent",
    "AccountingSourceTraceResponse",
    "trace_path",
    "journal_line_id",
    "finance_event_id",
    "source_label",
  ]) {
    assert.match(accountingTypes, new RegExp(token));
  }

  const endpoints = read("lib/api/endpoints.ts");
  for (const token of [
    "AccountingDrilldownParams",
    "drilldown",
    "journalEntry",
    "sourceTrace",
    "/accounting/drilldown",
    "/accounting/journal-entries/",
    "/accounting/source-trace",
  ]) {
    assert.match(endpoints, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.ok(
    exists("components/finance/accounting/accounting-drilldown-drawer.tsx"),
    "accounting-drilldown-drawer.tsx should exist"
  );
  const drawer = read("components/finance/accounting/accounting-drilldown-drawer.tsx");
  for (const token of [
    "AccountingDrilldownDrawer",
    "Trace path",
    "Report",
    "Journal",
    "Finance Event",
    "Source",
    "Journal line",
    "Source trace",
  ]) {
    assert.match(drawer, new RegExp(token));
  }

  const reportClient = read("components/finance/accounting/accounting-report-client.tsx");
  for (const token of [
    "AccountingDrilldownDrawer",
    "AccountingApis.drilldown",
    "openAccountDrilldown",
    "openJournalDrilldown",
    "Trace",
  ]) {
    assert.match(reportClient, new RegExp(token));
  }

  for (const componentPath of [
    "components/finance/accounting/trial-balance-table.tsx",
    "components/finance/accounting/profit-loss-statement.tsx",
    "components/finance/accounting/balance-sheet-statement.tsx",
  ]) {
    const source = read(componentPath);
    assert.match(source, /onOpenDrilldown/);
    assert.match(source, /Trace/);
  }
});

test("accounting report filters expose station scoped reports", () => {
  const accountingTypes = read("types/accounting.ts");
  assert.match(accountingTypes, /station\?: string/);

  const endpoints = read("lib/api/endpoints.ts");
  assert.match(endpoints, /station/);
  assert.match(endpoints, /params\.append\('station', station\)/);

  const filters = read("components/finance/accounting/financial-report-filters.tsx");
  for (const token of [
    "station",
    "onStationChange",
    "accounting-station",
    "Station",
    "Unassigned / mixed station",
  ]) {
    assert.match(filters, new RegExp(token));
  }

  for (const componentPath of [
    "components/finance/accounting/accounting-report-client.tsx",
    "components/finance/accounting/accounting-overview-client.tsx",
  ]) {
    const source = read(componentPath);
    assert.match(source, /setStation/);
    assert.match(source, /station,/);
    assert.match(source, /onStationChange/);
  }
});

test("accounting overview exposes accounting health checks before detailed reports", () => {
  const accountingTypes = read("types/accounting.ts");
  for (const token of [
    "AccountingHealthItem",
    "AccountingHealthResponse",
    "accounts_seeded",
    "mappings_seeded",
    "opening_balances_posted",
    "unposted_finance_events",
    "trial_balance_difference",
    "missing_mapping_count",
    "suspense_amount",
  ]) {
    assert.match(accountingTypes, new RegExp(token));
  }

  const endpoints = read("lib/api/endpoints.ts");
  assert.match(endpoints, /\bhealth:/);
  assert.match(endpoints, /\/accounting\/health\?/);

  const source = read("components/finance/accounting/accounting-overview-client.tsx");
  for (const token of [
    "AccountingHealthResponse",
    "Accounting Health",
    "healthItems",
    "accounts_seeded",
    "unposted_finance_events",
    "trial_balance_difference",
    "suspense_amount",
    "AccountingApis.health",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("operational finance report frontend exposes typed endpoint helpers", () => {
  assert.ok(exists("types/finance-reports.ts"), "types/finance-reports.ts should exist");
  const financeReportTypes = read("types/finance-reports.ts");
  for (const token of [
    "FinanceReportParams",
    "SalesBookReportResponse",
    "InvoiceReportResponse",
    "PaymentReportResponse",
    "RefundReportResponse",
    "VatSalesReportResponse",
  ]) {
    assert.match(financeReportTypes, new RegExp(`export type ${token}\\b`));
  }

  const endpoints = read("lib/api/endpoints.ts");
  assert.match(endpoints, /export const FinanceReportApis\b/);
  for (const helper of [
    "salesBook",
    "invoices",
    "payments",
    "refunds",
    "vatSales",
  ]) {
    assert.match(endpoints, new RegExp(`\\b${helper}:`));
  }
});

test("accounting route group and planned components exist", () => {
  for (const route of [
    "app/(dashboard)/finance/accounting/page.tsx",
    "app/(dashboard)/finance/accounting/setup/page.tsx",
    "app/(dashboard)/finance/accounting/opening-balances/page.tsx",
    "app/(dashboard)/finance/accounting/vouchers/page.tsx",
    "app/(dashboard)/finance/accounting/vouchers/[id]/page.tsx",
    "app/(dashboard)/finance/accounting/day-closes/page.tsx",
    "app/(dashboard)/finance/accounting/period-reports/page.tsx",
    "app/(dashboard)/finance/accounting/periods/page.tsx",
    "app/(dashboard)/finance/accounting/chart-of-accounts/page.tsx",
    "app/(dashboard)/finance/accounting/ledger-mapping/page.tsx",
    "app/(dashboard)/finance/accounting/general-ledger/page.tsx",
    "app/(dashboard)/finance/accounting/trial-balance/page.tsx",
    "app/(dashboard)/finance/accounting/profit-loss/page.tsx",
    "app/(dashboard)/finance/accounting/balance-sheet/page.tsx",
    "app/(dashboard)/finance/accounting/vat-summary/page.tsx",
    "app/(dashboard)/finance/accounting/customer-ledger/page.tsx",
    "app/(dashboard)/finance/accounting/supplier-ledger/page.tsx",
    "app/(dashboard)/finance/accounting/ar-aging/page.tsx",
    "app/(dashboard)/finance/accounting/ap-aging/page.tsx",
    "app/(dashboard)/finance/accounting/cash-flow/page.tsx",
    "app/(dashboard)/finance/accounting/daybook/page.tsx",
  ]) {
    assert.ok(exists(route), `${route} should exist`);
  }

  for (const component of [
    "components/finance/accounting/account-table.tsx",
    "components/finance/accounting/accounting-setup-client.tsx",
    "components/finance/accounting/opening-balance-client.tsx",
    "components/finance/accounting/journal-voucher-client.tsx",
    "components/finance/accounting/journal-voucher-detail-client.tsx",
    "components/finance/accounting/journal-voucher-form.tsx",
    "components/finance/accounting/reverse-journal-dialog.tsx",
    "components/finance/accounting/day-close-review-client.tsx",
    "components/finance/accounting/accounting-periods-client.tsx",
    "components/finance/accounting/ledger-mapping-table.tsx",
    "components/finance/accounting/financial-report-filters.tsx",
    "components/finance/accounting/trial-balance-table.tsx",
    "components/finance/accounting/profit-loss-statement.tsx",
    "components/finance/accounting/balance-sheet-statement.tsx",
    "components/finance/accounting/aging-report-client.tsx",
    "components/finance/accounting/mapping-exception-banner.tsx",
    "components/finance/accounting/daybook-client.tsx",
  ]) {
    assert.ok(exists(component), `${component} should exist`);
  }
});

test("accounting daybook UI exposes cash control and ledger sections", () => {
  const endpoints = read("lib/api/endpoints.ts");
  assert.match(endpoints, /\bdaybook:/);
  assert.match(endpoints, /\/accounting\/daybook/);

  const accountingTypes = read("types/accounting.ts");
  for (const token of [
    "DaybookCashTransaction",
    "AccountingDaybook",
    "cash_control",
    "payment_instruments",
    "ledger_impact",
  ]) {
    assert.match(accountingTypes, new RegExp(token));
  }

  const nav = read("components/finance/accounting/accounting-nav.tsx");
  assert.match(nav, /\/finance\/accounting\/daybook/);
  assert.match(nav, /Daybook/);

  const page = read("app/(dashboard)/finance/accounting/daybook/page.tsx");
  assert.match(page, /DaybookClient/);

  const source = read("components/finance/accounting/daybook-client.tsx");
  for (const token of [
    "DaybookClient",
    "AccountingApis.daybook",
    "Cash Control",
    "Payment Instruments",
    "Transfers",
    "Ledger Impact",
    "Exceptions",
    "opening_balance",
    "closing_balance",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting setup UI exposes setup status and repair workflow", () => {
  const nav = read("components/finance/accounting/accounting-nav.tsx");
  assert.match(nav, /\/finance\/accounting\/setup/);
  assert.match(nav, /Setup/);

  const page = read("app/(dashboard)/finance/accounting/setup/page.tsx");
  assert.match(page, /AccountingSetupClient/);

  const source = read("components/finance/accounting/accounting-setup-client.tsx");
  for (const token of [
    "AccountingSetupStatus",
    "AccountingApis.setupStatus",
    "AccountingApis.repairSetup",
    "AccountingApis.paymentInstruments",
    "AccountingApis.createPaymentInstrument",
    "Repair setup",
    "Payment instruments",
    "Accounting setup",
    "Core mappings",
    "Non-blocking mappings",
    "Chart of accounts",
    "missing_account_codes",
    "missing_mapping_count",
    "blocking_core_mapping_keys",
    "non_blocking_mapping_keys",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting opening balance UI exposes draft, post, and reverse workflow", () => {
  const nav = read("components/finance/accounting/accounting-nav.tsx");
  assert.match(nav, /\/finance\/accounting\/opening-balances/);
  assert.match(nav, /Opening Balances/);

  const page = read("app/(dashboard)/finance/accounting/opening-balances/page.tsx");
  assert.match(page, /OpeningBalanceClient/);

  const source = read("components/finance/accounting/opening-balance-client.tsx");
  for (const token of [
    "OpeningBalanceBatch",
    "OpeningBalanceBatchInput",
    "AccountingApis.openingBalances",
    "AccountingApis.createOpeningBalance",
    "AccountingApis.postOpeningBalance",
    "AccountingApis.reverseOpeningBalance",
    "Opening balances",
    "Post batch",
    "Reverse",
    "debit_total",
    "credit_total",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting journal voucher UI exposes manual voucher approval workflow", () => {
  const nav = read("components/finance/accounting/accounting-nav.tsx");
  assert.match(nav, /\/finance\/accounting\/vouchers/);
  assert.match(nav, /Vouchers/);

  const page = read("app/(dashboard)/finance/accounting/vouchers/page.tsx");
  assert.match(page, /JournalVoucherClient/);

  const form = read("components/finance/accounting/journal-voucher-form.tsx");
  for (const token of [
    "JournalVoucherInput",
    "JournalVoucherLineInput",
    "Create voucher",
    "Add line",
    "Impact preview",
    "debit",
    "credit",
  ]) {
    assert.match(form, new RegExp(token));
  }

  const source = read("components/finance/accounting/journal-voucher-client.tsx");
  for (const token of [
    "JournalVoucher",
    "JournalVoucherInput",
    "AccountingApis.journalVouchers",
    "AccountingApis.createJournalVoucher",
    "AccountingApis.submitJournalVoucher",
    "AccountingApis.approveJournalVoucher",
    "AccountingApis.rejectJournalVoucher",
    "AccountingApis.postJournalVoucher",
    "AccountingApis.reverseJournalEntry",
    "Manual journal vouchers",
    "Submit",
    "Approve",
    "Reject",
    "Post",
    "ReverseJournalDialog",
    "Reverse",
    "/finance/accounting/vouchers/",
    "draft",
    "submitted",
    "approved",
    "posted",
  ]) {
    assert.match(source, new RegExp(token));
  }

  const detailSource = read("components/finance/accounting/journal-voucher-detail-client.tsx");
  for (const token of [
    "JournalVoucherDetailClient",
    "AccountingApis.journalVouchers",
    "AccountingApis.reverseJournalEntry",
    "Submit",
    "Approve",
    "Reject",
    "Post",
    "ReverseJournalDialog",
    "Reverse",
    "Voucher drilldown",
  ]) {
    assert.match(detailSource, new RegExp(token));
  }

  const reverseDialog = read("components/finance/accounting/reverse-journal-dialog.tsx");
  for (const token of [
    "ReverseJournalDialog",
    "JournalEntryReverseInput",
    "reversal_date",
    "memo",
    "Reverse journal entry",
  ]) {
    assert.match(reverseDialog, new RegExp(token));
  }
});

test("accounting period UI exposes preflight, lock, and reopen workflow", () => {
  const nav = read("components/finance/accounting/accounting-nav.tsx");
  assert.match(nav, /\/finance\/accounting\/periods/);
  assert.match(nav, /Periods/);

  const page = read("app/(dashboard)/finance/accounting/periods/page.tsx");
  assert.match(page, /AccountingPeriodsClient/);

  const source = read("components/finance/accounting/accounting-periods-client.tsx");
  for (const token of [
    "AccountingPeriod",
    "AccountingPeriodGenerateInput",
    "AccountingPeriodPreflight",
    "AccountingApis.periods",
    "AccountingApis.generatePeriods",
    "AccountingApis.periodPreflight",
    "AccountingApis.softClosePeriod",
    "AccountingApis.lockPeriod",
    "AccountingApis.reopenPeriod",
    "Period preflight",
    "Daily review coverage",
    "required_day_closes",
    "confirmed_day_closes",
    "reviewed_day_closes",
    "unreviewed_day_closes",
    "missing_operational_days",
    "invalidated_review_days",
    "Review day closes",
    "Generate periods",
    "Soft close",
    "Lock period",
    "Reopen",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting pages use live API-backed clients instead of unsupported placeholders", () => {
  for (const route of [
    "app/(dashboard)/finance/accounting/chart-of-accounts/page.tsx",
    "app/(dashboard)/finance/accounting/ledger-mapping/page.tsx",
    "app/(dashboard)/finance/accounting/general-ledger/page.tsx",
    "app/(dashboard)/finance/accounting/profit-loss/page.tsx",
    "app/(dashboard)/finance/accounting/balance-sheet/page.tsx",
    "app/(dashboard)/finance/accounting/vat-summary/page.tsx",
    "app/(dashboard)/finance/accounting/customer-ledger/page.tsx",
    "app/(dashboard)/finance/accounting/supplier-ledger/page.tsx",
    "app/(dashboard)/finance/accounting/cash-flow/page.tsx",
  ]) {
    const source = read(route);
    assert.doesNotMatch(source, /UnsupportedAccountingPage/);
    assert.doesNotMatch(source, /API is not available yet/);
  }
});

test("accounting report client exposes customer ledger, supplier ledger, and cash-flow views", () => {
  const nav = read("components/finance/accounting/accounting-nav.tsx");
  for (const token of [
    "/finance/accounting/customer-ledger",
    "/finance/accounting/supplier-ledger",
    "/finance/accounting/cash-flow",
    "Customer Ledger",
    "Supplier Ledger",
    "Cash Flow",
  ]) {
    assert.match(nav, new RegExp(token));
  }

  const source = read("components/finance/accounting/accounting-report-client.tsx");
  for (const token of [
    "customer-ledger",
    "supplier-ledger",
    "cash-flow",
    "CustomerLedgerResponse",
    "SupplierLedgerResponse",
    "CashFlowResponse",
    "AccountingReportApis.customerLedger",
    "AccountingReportApis.supplierLedger",
    "AccountingReportApis.cashFlow",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting aging UI exposes AR/AP aging and statement bridge workflow", () => {
  const accountingTypes = read("types/accounting.ts");
  for (const token of [
    "AgingBucketSummary",
    "ARAgingResponse",
    "APAgingResponse",
    "StatementMovementRow",
    "CustomerStatementResponse",
    "SupplierStatementResponse",
    "PaymentSettlementLine",
    "PaymentSettlementBatch",
    "PaymentSettlementPreviewLine",
    "PaymentSettlementPreviewResponse",
    "PaymentSettlementPreviewInput",
    "PaymentSettlementCreateInput",
    "PaymentSettlementVarianceApprovalInput",
    "bucket_1_7",
    "over_90",
    "opening_balance",
    "closing_balance",
  ]) {
    assert.match(accountingTypes, new RegExp(token));
  }

  const endpoints = read("lib/api/endpoints.ts");
  for (const token of [
    "arAging",
    "apAging",
    "customerStatement",
    "supplierStatement",
    "settlements",
    "previewSettlement",
    "createSettlement",
    "matchSettlement",
    "approveSettlementVariance",
    "postSettlement",
    "reverseSettlement",
    "/accounting/ar-aging",
    "/accounting/ap-aging",
    "/accounting/customer-statement",
    "/accounting/supplier-statement",
    "/accounting/settlements",
    "/accounting/settlements/preview",
    "approve-variance",
  ]) {
    assert.match(endpoints, new RegExp(token));
  }

  const nav = read("components/finance/accounting/accounting-nav.tsx");
  for (const token of [
    "/finance/accounting/ar-aging",
    "/finance/accounting/ap-aging",
    "/finance/accounting/settlements",
    "AR Aging",
    "AP Aging",
    "Settlements",
  ]) {
    assert.match(nav, new RegExp(token));
  }

  const arPage = read("app/(dashboard)/finance/accounting/ar-aging/page.tsx");
  const apPage = read("app/(dashboard)/finance/accounting/ap-aging/page.tsx");
  assert.match(arPage, /AgingReportClient/);
  assert.match(arPage, /mode="ar"/);
  assert.match(apPage, /AgingReportClient/);
  assert.match(apPage, /mode="ap"/);

  const source = read("components/finance/accounting/aging-report-client.tsx");
  for (const token of [
    "AgingReportClient",
    "AccountingApis.arAging",
    "AccountingApis.apAging",
    "AccountingApis.customerStatement",
    "AccountingApis.supplierStatement",
    "Why balance changed",
    "Opening balance",
    "New invoices",
    "New payables",
    "Receipts",
    "Payments",
    "Statement",
    "bucket_1_7",
    "over_90",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting settlement UI exposes POS-to-bank bridge workflow", () => {
  assert.ok(
    exists("app/(dashboard)/finance/accounting/settlements/page.tsx"),
    "settlement route should exist"
  );
  assert.ok(
    exists("components/finance/accounting/settlement-reconciliation-client.tsx"),
    "settlement reconciliation client should exist"
  );

  const page = read("app/(dashboard)/finance/accounting/settlements/page.tsx");
  assert.match(page, /SettlementReconciliationClient/);

  const source = read("components/finance/accounting/settlement-reconciliation-client.tsx");
  for (const token of [
    "SettlementReconciliationClient",
    "AccountingApis.settlements",
    "AccountingApis.previewSettlement",
    "AccountingApis.createSettlement",
    "AccountingApis.matchSettlement",
    "AccountingApis.approveSettlementVariance",
    "AccountingApis.postSettlement",
    "AccountingApis.reverseSettlement",
    "POS collections",
    "Refunds",
    "Processor fees",
    "Bank deposit",
    "Settlement variance",
    "Create batch",
    "Approve variance",
    "Post settlement",
    "Reverse",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting VAT export UI exposes validation and materialized export workflow", () => {
  assert.ok(
    exists("app/(dashboard)/finance/accounting/vat-export/page.tsx"),
    "VAT export route should exist"
  );
  assert.ok(
    exists("components/finance/accounting/vat-export-client.tsx"),
    "VAT export client should exist"
  );

  const accountingTypes = read("types/accounting.ts");
  for (const token of [
    "VatExportRequest",
    "VatExportRun",
    "validation_errors_json",
    "sales_book_total",
    "vat_summary_total",
    "can_generate",
  ]) {
    assert.match(accountingTypes, new RegExp(token));
  }

  const endpoints = read("lib/api/endpoints.ts");
  for (const token of [
    "vatExportRuns",
    "validateVatExport",
    "generateVatExport",
    "downloadVatExport",
    "/accounting/vat-export/runs",
    "/accounting/vat-export/validate",
    "/accounting/vat-export/generate",
    "/accounting/vat-export/",
  ]) {
    assert.match(endpoints, new RegExp(token));
  }

  const nav = read("components/finance/accounting/accounting-nav.tsx");
  assert.match(nav, /\/finance\/accounting\/vat-export/);
  assert.match(nav, /VAT Export/);

  const page = read("app/(dashboard)/finance/accounting/vat-export/page.tsx");
  assert.match(page, /VatExportClient/);

  const source = read("components/finance/accounting/vat-export-client.tsx");
  for (const token of [
    "VatExportClient",
    "AccountingApis.vatExportRuns",
    "AccountingApis.validateVatExport",
    "AccountingApis.generateVatExport",
    "AccountingApis.downloadVatExport",
    "Validate VAT",
    "Generate export",
    "Download CSV",
    "Sales Book VAT",
    "Ledger VAT Summary",
    "Validation errors",
    "VAT export runs",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("general ledger rows expose journal drilldown links for reversal workflows", () => {
  const source = read("components/finance/accounting/accounting-report-client.tsx");
  for (const token of [
    "journal_entry_id",
    "/finance/accounting/vouchers/",
    "Open voucher",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting overview exposes backfill dry-run and commit controls", () => {
  const source = read("components/finance/accounting/accounting-overview-client.tsx");

  for (const token of [
    "AccountingBackfillRun",
    "backfillDryRun",
    "backfillCommit",
    "backfillRuns",
    "Dry Run Backfill",
    "Commit Backfill",
    "Backfill Runs",
    "missing_mapping_count",
    "journals_posted",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting UI uses production accounting permissions for reports and actions", () => {
  const permissions = read("lib/role-permissions.ts");
  for (const token of [
    "finance.accounting.view",
    "finance.accounting.setup",
    "finance.accounting.opening_balances.manage",
    "finance.accounting.vouchers.create",
    "finance.accounting.vouchers.approve",
    "finance.accounting.vouchers.post",
    "finance.accounting.vouchers.reverse",
    "finance.accounting.periods.close",
    "finance.accounting.periods.lock",
    "finance.accounting.periods.reopen",
    "finance.accounting.settlements.manage",
    "finance.accounting.vat.export",
    "finance.accounting.override_locked_period",
    '"/finance/accounting": "finance.accounting.view"',
  ]) {
    assert.match(permissions, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const componentPath of [
    "components/finance/accounting/accounting-overview-client.tsx",
    "components/finance/accounting/accounting-report-client.tsx",
    "components/finance/accounting/accounting-master-data-client.tsx",
    "components/finance/accounting/accounting-setup-client.tsx",
    "components/finance/accounting/opening-balance-client.tsx",
    "components/finance/accounting/journal-voucher-client.tsx",
    "components/finance/accounting/journal-voucher-detail-client.tsx",
    "components/finance/accounting/accounting-periods-client.tsx",
    "components/finance/accounting/settlement-reconciliation-client.tsx",
    "components/finance/accounting/vat-export-client.tsx",
    "components/finance/accounting/aging-report-client.tsx",
  ]) {
    const source = read(componentPath);
    assert.match(source, /finance\.accounting\.view/, `${componentPath} should require accounting view permission`);
  }

  const setup = read("components/finance/accounting/accounting-setup-client.tsx");
  assert.match(setup, /finance\.accounting\.setup/);
  assert.match(setup, /Setup repair requires/);

  const openingBalances = read("components/finance/accounting/opening-balance-client.tsx");
  assert.match(openingBalances, /finance\.accounting\.opening_balances\.manage/);
  assert.match(openingBalances, /Opening balance management requires/);

  const vouchers = read("components/finance/accounting/journal-voucher-client.tsx");
  for (const token of [
    "finance.accounting.vouchers.create",
    "finance.accounting.vouchers.approve",
    "finance.accounting.vouchers.post",
    "finance.accounting.vouchers.reverse",
    "Voucher creation requires",
  ]) {
    assert.match(vouchers, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const periods = read("components/finance/accounting/accounting-periods-client.tsx");
  for (const token of [
    "finance.accounting.periods.close",
    "finance.accounting.periods.lock",
    "finance.accounting.periods.reopen",
    "Period generation and soft close require",
  ]) {
    assert.match(periods, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const settlements = read("components/finance/accounting/settlement-reconciliation-client.tsx");
  assert.match(settlements, /finance\.accounting\.settlements\.manage/);
  assert.match(settlements, /Settlement management requires/);

  const vatExport = read("components/finance/accounting/vat-export-client.tsx");
  assert.match(vatExport, /finance\.accounting\.vat\.export/);
  assert.match(vatExport, /VAT export requires/);
});

test("accounting navigation groups workflows for owner and accountant use", () => {
  const nav = read("components/finance/accounting/accounting-nav.tsx");

  for (const token of [
    "accountingNavGroups",
    "Start here",
    "Controls",
    "Ledgers & Reports",
    "Tax & Settlement",
    "aria-label=\"Accounting navigation\"",
    "Health",
    "Setup",
    "Opening Balances",
    "Vouchers",
    "Day Closes",
    "Period Reports",
    "Periods",
    "Settlements",
    "AR Aging",
    "AP Aging",
    "VAT Export",
  ]) {
    assert.match(nav, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("accounting day-close review bridges operational close to ledger checks", () => {
  const types = read("types/accounting.ts");
  for (const token of [
    "AccountingDayClosePostingStatus",
    "DayCloseAccountingReview",
    "AccountingDayCloseEvidence",
    "AccountingDayClose",
    "cash_variance",
    "unposted_finance_events",
    "trial_balance_difference",
    "suspense_amount",
    "blockers",
  ]) {
    assert.match(types, new RegExp(token));
  }

  const endpoints = read("lib/api/endpoints.ts");
  for (const token of [
    "dayCloses",
    "dayClose",
    "dayClosePostingStatus",
    "postDayCloseMissingEvents",
    "dayCloseReview",
    "evaluateDayClose",
    "approveDayCloseReview",
    "dayCloseEvidence",
    "dayCloseJournalTrace",
    "/accounting/day-closes",
    "/posting-status",
    "/post-missing-events",
    "/review",
    "/evaluate",
    "/approve",
    "/evidence",
    "/journal-trace",
  ]) {
    assert.match(endpoints, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const nav = read("components/finance/accounting/accounting-nav.tsx");
  for (const token of [
    "/finance/accounting/day-closes",
    "/finance/accounting/period-reports",
    "Day Closes",
    "Period Reports",
  ]) {
    assert.match(nav, new RegExp(token));
  }

  const globalSearch = read("components/layout/global-search.tsx");
  for (const token of [
    "/finance/accounting/day-closes",
    "/finance/accounting/period-reports",
    "Accounting Day Closes",
    "Accounting Period Reports",
  ]) {
    assert.match(globalSearch, new RegExp(token));
  }

  const page = read("app/(dashboard)/finance/accounting/day-closes/page.tsx");
  assert.match(page, /DayCloseReviewClient/);
  const alias = read("app/(dashboard)/finance/accounting/period-reports/page.tsx");
  assert.match(alias, /period-reports\/page/);

  const periodReports = read("app/(dashboard)/period-reports/page.tsx");
  for (const token of [
    "Operational Period Reports",
    "Ledger locking is controlled from Accounting Periods",
    "Review operational report",
    "Confirm operational period report",
  ]) {
    assert.match(periodReports, new RegExp(token));
  }

  const client = read("components/finance/accounting/day-close-review-client.tsx");
  for (const token of [
    "Day Close Review",
    "Accounting Checks",
    "AccountingApis.dayCloses",
    "AccountingApis.postDayCloseMissingEvents",
    "AccountingApis.evaluateDayClose",
    "AccountingApis.approveDayCloseReview",
    "AccountingApis.dayCloseEvidence",
    "AccountingApis.dayCloseJournalTrace",
    "Evaluate accounting",
    "Post missing events",
    "Approve daily review",
    "Resolve mappings",
    "Open settlement reconciliation",
    "Create correction voucher",
    "Open source trace",
    "Operational status",
    "Review status",
    "Drawer reconciliation",
    "Sales",
    "Collections",
    "Refunds",
    "Operating expenses",
    "Inventory outflows",
    "Receivables",
    "Instruments",
    "Audit trail",
    "cash_variance",
    "suspense_amount",
  ]) {
    assert.match(client, new RegExp(token));
  }

  const snapshotView = read("components/analytics/day-close-snapshot-panel.tsx");
  for (const token of [
    "Accounting Checks",
    "accounting_bridge",
    "Open accounting review",
  ]) {
    assert.match(snapshotView, new RegExp(token));
  }
});

test("accounting event labels explain system event types in accountant language", () => {
  const source = read("lib/accounting-event-labels.ts");

  for (const token of [
    "ACCOUNTING_EVENT_LABELS",
    "ACCOUNTING_EVENT_OPTIONS",
    "inventory_cash_outflow",
    "Inventory purchase paid",
    "inventory_return_processed",
    "Inventory return processed",
    "supplier_payable_created",
    "Supplier payable created",
    "collection_received",
    "Payment collected",
    "credit_sale_created",
    "Credit sale created",
    "paymentMethodSensitive",
    "const normalized = eventType.trim",
    "Select finance event",
    "mappingPriorityHelp",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting report filters expose presets reset scope and report basis", () => {
  const source = read("components/finance/accounting/financial-report-filters.tsx");

  for (const token of [
    "DATE_PRESETS",
    "Today",
    "This Month",
    "Last Month",
    "onReset",
    "businessLine",
    "reportBasis",
    "Active scope",
    "Reset filters",
  ]) {
    assert.match(source, new RegExp(token));
  }
});

test("accounting overview groups accountant workflows by purpose", () => {
  const overview = read("components/finance/accounting/accounting-overview-client.tsx");
  const nav = read("components/finance/accounting/accounting-nav.tsx");

  for (const token of [
    "Accounting health",
    "Daily controls",
    "Financial statements",
    "People ledgers",
    "Setup",
    "Resolve Exceptions",
    "Create Voucher",
    "Open Reports",
  ]) {
    assert.match(overview, new RegExp(token));
  }

  for (const token of ["Overview", "Reports", "Setup", "Controls"]) {
    assert.match(nav, new RegExp(token));
  }
});

test("ledger mapping UI supports accountant-safe manual mapping edits", () => {
  const table = read("components/finance/accounting/ledger-mapping-table.tsx");
  const dialog = read("components/finance/accounting/ledger-mapping-dialog.tsx");
  const master = read("components/finance/accounting/accounting-master-data-client.tsx");

  for (const token of [
    "accountingEventLabel",
    "ACCOUNTING_EVENT_OPTIONS",
    "Edit Mapping",
    "Select finance event",
    "PAYMENT_METHOD_OPTIONS",
    "Any method",
    "EVENTS_REQUIRING_EXACT_PAYMENT_METHOD",
    "Select a specific payment method for this event.",
    "Mapping changes apply to future postings only",
    "reason",
    "debit_account_id",
    "credit_account_id",
    "is_active",
  ]) {
    assert.match(`${table}\n${dialog}\n${master}`, new RegExp(token));
  }
});

test("mapping exceptions are presented as an actionable resolver queue", () => {
  const resolver = read("components/finance/accounting/mapping-exception-resolver.tsx");
  const overview = read("components/finance/accounting/accounting-overview-client.tsx");
  const endpoints = read("lib/api/endpoints.ts");
  const types = read("types/accounting.ts");

  for (const token of [
    "MappingExceptionResolver",
    "MappingExceptionRepostRequest",
    "MappingExceptionRepostResult",
    "AccountingApis.reverseRepostMappingException",
    "Create mapping for future postings",
    "Open source trace",
    "Create correction voucher",
    "Reverse and repost",
    "This reverses existing suspense journals and reposts them through the active mapping.",
    "does not automatically fix already-posted journals",
  ]) {
    assert.match(`${resolver}\n${overview}\n${endpoints}\n${types}`, new RegExp(token));
  }
});

test("chart of accounts UI supports search filters and account usage warnings", () => {
  const table = read("components/finance/accounting/account-table.tsx");
  const master = read("components/finance/accounting/accounting-master-data-client.tsx");

  for (const token of [
    "Search accounts",
    "Filter by type",
    "Suspense account",
    "Used in mappings",
    "Deactivate",
  ]) {
    assert.match(`${table}\n${master}`, new RegExp(token));
  }
});
