/** Bookmarks from the retired module lead to the current Finance workspaces. */
export function retiredAccountingDestination(segments: string[] = [], search: Record<string, string | string[] | undefined> = {}): string {
  const destinations: Record<string, string> = {
    "vat-summary": "/finance/reports/vat-summary", "vat-export": "/finance/reports/vat-summary",
    "profit-loss": "/finance/reports/profit-and-loss", "balance-sheet": "/finance/reports/balance-sheet",
    "trial-balance": "/finance/reports/trial-balance", "general-ledger": "/finance/reports/account-ledger",
    "cash-flow": "/finance/reports/cash-flow", daybook: "/finance/reports/daybook",
    "customer-ledger": "/finance/reports/party-balances", "supplier-ledger": "/finance/reports/party-balances",
    "ar-aging": "/finance/reports/party-balances", "ap-aging": "/finance/reports/party-balances",
    setup: "/finance/setup", "chart-of-accounts": "/finance/setup", "ledger-mapping": "/finance/setup",
    "opening-balances": "/finance/setup", vouchers: "/finance/journals", periods: "/day-close",
    settlements: "/finance/reports/custody-reconciliation", inventory: "/inventory", "day-closes": "/day-close",
  };
  if (segments[0] === "day-closes" && typeof search.day_close_id === "string" && /^\d+$/.test(search.day_close_id)) {
    return `/day-close?detail=${encodeURIComponent(search.day_close_id)}`;
  }
  // Old voucher IDs belong to a different ledger; do not reinterpret them as new journal IDs.
  return destinations[segments[0]] || "/finance/reports";
}
