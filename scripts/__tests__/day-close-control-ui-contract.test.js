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

function assertIncludes(source, token) {
  assert.ok(source.includes(token), "Expected source to include: " + token);
}

test("day-close drawer controls expose typed API helpers", () => {
  const types = read("types/day-close.ts");
  for (const token of [
    "export type DrawerSessionStatus",
    "export interface DrawerSession",
    "export interface DrawerOpeningSuggestion",
    "export interface DrawerClosingPrompt",
    "export interface DrawerConfiguration",
    "export interface DrawerSessionOpenInput",
    "export interface DrawerClosingCountInput",
    "export interface DrawerExpectedBreakdown",
    "export interface DrawerVarianceApprovalInput",
    "export interface DrawerSettlementDecisionInput",
  ]) {
    assertIncludes(types, token);
  }

  const endpoints = read("lib/api/endpoints.ts");
  assertIncludes(endpoints, "export const DrawerSessionApis");
  for (const helper of [
    "configurations:",
    "setControls:",
    "suggestion:",
    "open:",
    "active:",
    "movement:",
    "closingPrompt:",
    "expectedBreakdown:",
    "cashControlSummary:",
    "closingCount:",
    "settlementDecision:",
    "approveVariance:",
    "reopen:",
  ]) {
    assertIncludes(endpoints, helper);
  }
});

test("cashier day-close UI has drawer opening closing and operational status components", () => {
  for (const componentPath of [
    "components/day-close/drawer-session-panel.tsx",
    "components/day-close/drawer-count-dialog.tsx",
    "components/day-close/operational-close-status.tsx",
  ]) {
    assert.ok(exists(componentPath), componentPath + " should exist");
  }

  const panel = read("components/day-close/drawer-session-panel.tsx");
  for (const token of [
    "DrawerSessionPanel",
    "Opening float source",
    "Counted opening cash",
    "Open drawer",
    "Count drawer",
    "Request variance approval",
    "Settle drawer",
    "Settlement pending",
    "Expected cash",
    "Cash sales",
    "Drops / transfers",
    "previous_retained_float",
    "Confirm and open",
    "Report different amount",
    "overrideRetained",
    "opening_difference_source",
    "opening_difference_destination",
    "Difference source",
    "From safe",
    "Unexplained",
    "DrawerSessionApis.suggestion",
    "DrawerSessionApis.open",
    "DrawerSessionApis.active",
    "DrawerSessionApis.expectedBreakdown",
  ]) {
    assertIncludes(panel, token);
  }

  const cashDrawersPage = read("app/(dashboard)/cash-drawers/page.tsx");
  for (const token of [
    "Cash Drawers",
    "DrawerSessionPanel",
    "Cash in drawers",
    "Configure drawers",
    "Active drawer",
    "Checkout uses the logged-in cashier's active drawer",
    "restaurant?.current_business_date",
    "businessDate=",
    "Operational business date unavailable",
    "session.configuration_name || session.drawer_key",
    "Business date",
    "Opened:",
    "Closed:",
  ]) {
    assertIncludes(cashDrawersPage, token);
  }

  const restaurantHook = read("hooks/use-restaurant.ts");
  assertIncludes(restaurantHook, "current_business_date?: string | null");

  const countDialog = read("components/day-close/drawer-count-dialog.tsx");
  for (const token of [
    "DrawerCountDialog",
    "Drawer reconciliation",
    "Expected cash",
    "Actual cash count",
    "Short / over",
    "Submit count with variance",
    "Correct count",
    "Submit corrected count",
    "recountMode",
    "isZeroCashSettlement",
    "There is no physical cash to allocate",
    "response?.data?.detail",
    "denominations",
    "DrawerSessionApis.closingPrompt",
    "DrawerSessionApis.closingCount",
    "DrawerSessionApis.settlementDecision",
    "finance.drawer.close.own",
    "finance.variance.approve",
    "Where should the counted cash go?",
    "Available as the next opening float.",
    "No transfers. All allocated cash stays in the drawer.",
    "Deposit slip or transfer reference",
  ]) {
    assertIncludes(countDialog, token);
  }

  assertIncludes(countDialog, "finance.cash.transfer.to_bank");

  const status = read("components/day-close/operational-close-status.tsx");
  for (const token of [
    "OperationalCloseStatus",
    "Operational day closed",
    "Finance check complete",
    "Finance review required",
    "Cash counted",
  ]) {
    assertIncludes(status, token);
  }
});

test("day-close uses a centralized plain-language presentation contract", () => {
  const presentation = read("lib/presentation/day-close.ts");
  for (const token of [
    "buildDayClosePresentation",
    "DAY_CLOSE_TERMS",
    "Activity included",
    "Payments collected",
    "Cash the system expects",
    "Cash counted",
    "Finance review required",
    "Counted from cash drawers",
    "Manually counted",
    "Not counted",
    "FIX_BLOCKERS",
    "RESOLVE_CASH",
    "CLOSE_DAY",
    "VIEW_RESULT",
  ]) {
    assertIncludes(presentation, token);
  }

  const flow = read("components/day-close/day-close-flow.tsx");
  for (const token of [
    "buildDayClosePresentation",
    "Review day",
    "Confirm cash",
    "Review close",
    "Day closed",
    "Cash the system expects",
  ]) {
    assertIncludes(flow, token);
  }
  assert.ok(!exists("components/analytics/day-close-modal.tsx"));
});
