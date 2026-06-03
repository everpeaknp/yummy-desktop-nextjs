/** Table status helpers for POS move/merge — mirrors backend table states. */

import { getApiErrorMessage } from "@/lib/api-response";
import {
  dispatchPosMutationSync,
  type SyncInvalidationDetail,
} from "@/lib/sync-invalidation";

export type TableTransferAction = "move" | "merge";

export function normalizeTableStatus(status: string | null | undefined): string {
  return String(status ?? "")
    .trim()
    .toUpperCase()
    .replace(/_/g, " ");
}

export function isTableFree(status: string | null | undefined): boolean {
  const s = normalizeTableStatus(status);
  return s === "FREE" || s === "AVAILABLE";
}

export function isTableMergeTarget(status: string | null | undefined): boolean {
  const s = normalizeTableStatus(status);
  return s === "OCCUPIED" || s === "BILL PRINTED" || s === "BILL_PRINTED";
}

export function isTableBlockedForTransfer(status: string | null | undefined): boolean {
  const s = normalizeTableStatus(status);
  return s === "PAYMENT COMPLETED" || s === "PAYMENT_COMPLETED" || s === "RESERVED";
}

export function getTableTransferAction(
  status: string | null | undefined
): TableTransferAction | null {
  if (isTableFree(status)) return "move";
  if (isTableMergeTarget(status)) return "merge";
  return null;
}

export function canSelectTableForTransfer(
  tableId: number,
  status: string | null | undefined,
  currentTableIds: number[]
): boolean {
  if (currentTableIds.includes(tableId)) return false;
  if (isTableBlockedForTransfer(status)) return false;
  return getTableTransferAction(status) != null;
}

export function tableTransferActionLabel(action: TableTransferAction): string {
  return action === "merge" ? "Merge into this table" : "Move here";
}

export function tableTransferConfirmTitle(
  action: TableTransferAction,
  tableName: string
): string {
  return action === "merge"
    ? `Merge bill into ${tableName}?`
    : `Move bill to ${tableName}?`;
}

export function tableTransferConfirmBody(action: TableTransferAction): string {
  return action === "merge"
    ? "This will merge bills into the existing order on that table. Items are combined on the server; the current bill is canceled after merge."
    : "This will move the bill to the selected free table.";
}

export function formatAssignedTablesLabel(
  tableIds: number[],
  tableName?: string | null
): string {
  if (!tableIds.length) return tableName || "No table";
  if (tableIds.length === 1) {
    const names = splitTableNames(tableName);
    return names[0] || `Table ${tableIds[0]}`;
  }
  const names = splitTableNames(tableName);
  const primary = names[0] || `Table ${tableIds[0]}`;
  const extra = tableIds.length - 1;
  return `${primary} + ${extra} more`;
}

export function splitTableNames(tableName?: string | null): string[] {
  if (!tableName) return [];
  return tableName
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function dispatchTablesRefresh(detail?: SyncInvalidationDetail): void {
  dispatchPosMutationSync(detail);
}

export function extractApiDetail(err: unknown): string {
  return getApiErrorMessage(err);
}
