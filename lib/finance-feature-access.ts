export type FinanceFeatureKey = "reports" | "accounting";

export type FinanceFeatureRestaurant = {
  finance_reports_enabled?: boolean;
  finance_accounting_enabled?: boolean;
} | null;

export function isFinanceFeatureEnabled(
  restaurant: FinanceFeatureRestaurant,
  feature: FinanceFeatureKey,
): boolean {
  if (!restaurant) {
    return true;
  }

  if (feature === "reports") {
    return restaurant.finance_reports_enabled !== false;
  }

  return restaurant.finance_accounting_enabled !== false;
}
