/** Table status helpers for POS move/merge — mirrors backend table states. */

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

export function dispatchTablesRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("yummy:tables-refresh"));
}

export function extractApiDetail(err: unknown): string {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    if (typeof row.detail === "string" && row.detail.trim()) return row.detail;
    if (typeof row.message === "string" && row.message.trim()) return row.message;
    if (Array.isArray(row.detail)) {
      return row.detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg?: string }).msg ?? "");
          }
          return "";
        })
        .filter(Boolean)
        .join(". ");
    }
  }
  return "Request failed. Please try again.";
}
