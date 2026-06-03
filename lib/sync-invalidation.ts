/**
 * Event-based cache invalidation (no React Query).
 * Screens subscribe via `useSyncInvalidation` and refetch from the backend.
 */

export type SyncDomain =
  | "orders"
  | "tables"
  | "dashboard"
  | "analytics"
  | "transactions"
  | "finance"
  | "day-close";

export type SyncInvalidationDetail = {
  orderId?: number;
  reason?: string;
};

export const POS_MUTATION_DOMAINS: SyncDomain[] = [
  "orders",
  "tables",
  "dashboard",
  "analytics",
  "transactions",
];

export const FINANCE_MUTATION_DOMAINS: SyncDomain[] = [
  "finance",
  "dashboard",
  "analytics",
  "day-close",
];

export const DAY_CLOSE_CONFIRM_DOMAINS: SyncDomain[] = [
  "day-close",
  "finance",
  "dashboard",
  "analytics",
  "transactions",
];

function domainEventName(domain: SyncDomain): string {
  return `yummy:invalidate:${domain}`;
}

export function invalidateSyncDomains(
  domains: SyncDomain[],
  detail?: SyncInvalidationDetail
): void {
  if (typeof window === "undefined") return;
  const seen = new Set<SyncDomain>();
  for (const domain of domains) {
    if (seen.has(domain)) continue;
    seen.add(domain);
    window.dispatchEvent(
      new CustomEvent(domainEventName(domain), { detail: detail ?? {} })
    );
  }
}

/** After POS payment, table move/merge, split, or order patch. */
export function dispatchPosMutationSync(detail?: SyncInvalidationDetail): void {
  invalidateSyncDomains(POS_MUTATION_DOMAINS, detail);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("yummy:tables-refresh", { detail: detail ?? {} })
    );
  }
}

/** After expense / purchase / manual income changes. */
export function dispatchFinanceMutationSync(detail?: SyncInvalidationDetail): void {
  invalidateSyncDomains(FINANCE_MUTATION_DOMAINS, detail);
}

/** After day close is confirmed — snapshot is authoritative. */
export function dispatchDayCloseConfirmSync(detail?: SyncInvalidationDetail): void {
  invalidateSyncDomains(DAY_CLOSE_CONFIRM_DOMAINS, detail);
}
