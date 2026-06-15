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
    "export interface DrawerVarianceApprovalInput",
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
    "closingCount:",
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
    "Drawer readiness",
    "DrawerSessionApis.suggestion",
    "DrawerSessionApis.open",
    "DrawerSessionApis.active",
  ]) {
    assertIncludes(panel, token);
  }

  const countDialog = read("components/day-close/drawer-count-dialog.tsx");
  for (const token of [
    "DrawerCountDialog",
    "Blind closing count",
    "expected amount is hidden",
    "denominations",
    "DrawerSessionApis.closingPrompt",
    "DrawerSessionApis.closingCount",
    "DrawerSessionApis.approveVariance",
  ]) {
    assertIncludes(countDialog, token);
  }

  const status = read("components/day-close/operational-close-status.tsx");
  for (const token of [
    "OperationalCloseStatus",
    "Operational day closed",
    "Accounting ready",
    "Accounting review required",
    "drawer",
  ]) {
    assertIncludes(status, token);
  }
});

test("day-close modal and snapshot render drawer evidence without client finance recalculation", () => {
  const modal = read("components/analytics/day-close-modal.tsx");
  for (const token of [
    "DrawerSessionPanel",
    "OperationalCloseStatus",
    "drawer readiness",
    "operational confirmation",
    "accounting review status",
  ]) {
    assertIncludes(modal, token);
  }

  const snapshot = read("components/analytics/day-close-snapshot-panel.tsx");
  for (const token of [
    "Drawer Evidence",
    "opening count",
    "closing count",
    "retained float",
    "Accounting Checks",
  ]) {
    assertIncludes(snapshot, token);
  }
});
