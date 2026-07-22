import type {
  CurrentSubscription,
  EntitlementMap,
  EntitlementValue,
  SubscriptionCatalog,
  SubscriptionPlan,
  SubscriptionPrice,
} from "./types";

const ENTITLEMENT_LABELS: Record<string, string> = {
  "users.max": "team users",
  "branches.max": "branches",
  "tables.max": "tables",
  "menu_items.max": "menu items",
  "printers.max": "printers",
  "static_qrs.max": "static QR codes",
  "attendance.devices.max": "biometric devices",
  "orders.dine_in.enabled": "Dine-in ordering",
  "orders.takeaway.enabled": "Takeaway ordering",
  "orders.delivery.enabled": "Delivery ordering",
  "kitchen.kot.enabled": "Kitchen order tickets",
  "kitchen.bot.enabled": "Bar order tickets",
  "menu.modifiers.enabled": "Menu modifiers and add-ons",
  "menu.qr_ordering.enabled": "QR ordering",
  "reservations.enabled": "Reservations",
  "customers.crm.enabled": "Customer CRM",
  "customers.loyalty.enabled": "Customer loyalty",
  "customers.feedback.enabled": "Customer feedback",
  "inventory.enabled": "Inventory management",
  "inventory.suppliers.enabled": "Supplier management",
  "inventory.recipe_costing.enabled": "Recipe costing",
  "finance.income_expense.enabled": "Income and expense tracking",
  "finance.daybook.enabled": "Daybook",
  "finance.cash_drawer.enabled": "Cash drawer sessions",
  "finance.period_close.enabled": "Period close",
  "finance.full_history.enabled": "Full finance history",
  "finance.live_insights.enabled": "Live finance insights",
  "finance.accounting.enabled": "Full accounting",
  "payroll.enabled": "Payroll",
  "staff.performance.enabled": "Staff performance",
  "designers.receipt.enabled": "Receipt designer",
  "designers.kot.enabled": "KOT designer",
  "payments.credit.enabled": "Credit payments",
  "payments.fonepay.enabled": "Fonepay integration",
  "payments.gateway.enabled": "Payment gateway integrations",
  "attendance.mobile.enabled": "Mobile attendance",
  "attendance.biometric.enabled": "Biometric attendance",
  "business.multi_location.enabled": "Multi-location management",
  "business.hotel.enabled": "Hotel module",
  "ebilling.cbms.enabled": "eBilling and IRD CBMS",
  "integrations.api.enabled": "API access",
  "integrations.webhooks.enabled": "Webhooks",
};

// Canonical V2 values always win. These aliases only keep restaurants that
// have not yet been assigned a V2 subscription on their existing plan rules.
const LEGACY_ENTITLEMENT_ALIASES: Record<string, string> = {
  "users.max": "max_non_admin_users",
  "tables.max": "max_tables",
  "menu_items.max": "max_menu_items",
  "printers.max": "max_printers",
  "static_qrs.max": "max_static_qrs",
  "finance.history_days": "receipt_history_days",
  "finance.history_records.max": "receipt_history_max_records",
  "designers.kot.enabled": "can_use_kot_designer",
  "designers.receipt.enabled": "can_use_receipt_designer",
  "customers.crm.enabled": "can_manage_customers",
  "inventory.suppliers.enabled": "can_manage_suppliers",
  "inventory.enabled": "can_manage_inventory",
  "payments.credit.enabled": "can_use_credit_payment",
  "reservations.enabled": "can_use_reservations",
  "finance.daybook.enabled": "can_use_day_close",
  "finance.period_close.enabled": "can_use_period_close",
  "finance.full_history.enabled": "can_view_full_finance_history",
  "payroll.enabled": "can_manage_payroll",
};

function hasOwn(entitlements: EntitlementMap | null | undefined, key: string): boolean {
  return Boolean(entitlements) && Object.prototype.hasOwnProperty.call(entitlements, key);
}

export function entitlementValue(
  entitlements: EntitlementMap | null | undefined,
  key: string,
): EntitlementValue | undefined {
  return hasOwn(entitlements, key) ? entitlements?.[key] : undefined;
}

export function isEntitlementEnabled(
  entitlements: EntitlementMap | null | undefined,
  key: string,
  fallback = false,
): boolean {
  const value = entitlementValue(entitlements, key);
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return ["true", "enabled", "yes", "1"].includes(value.toLowerCase());
  return false;
}

export function hasResolvedEntitlement(
  entitlements: EntitlementMap | null | undefined,
  key: string,
): boolean {
  if (hasOwn(entitlements, key)) return true;
  const legacyKey = LEGACY_ENTITLEMENT_ALIASES[key];
  return Boolean(legacyKey) && hasOwn(entitlements, legacyKey);
}

export function isResolvedEntitlementEnabled(
  entitlements: EntitlementMap | null | undefined,
  key: string,
  legacyFallback = false,
): boolean {
  if (hasOwn(entitlements, key)) {
    return isEntitlementEnabled(entitlements, key, legacyFallback);
  }
  const legacyKey = LEGACY_ENTITLEMENT_ALIASES[key];
  if (legacyKey && hasOwn(entitlements, legacyKey)) {
    return isEntitlementEnabled(entitlements, legacyKey, legacyFallback);
  }
  return legacyFallback;
}

function isV2SubscriptionContext(current: CurrentSubscription | null): boolean {
  return Boolean(
    current?.subscription &&
      (current.subscription.id != null || current.subscription.plan_version != null),
  );
}

export function hasResolvedSubscriptionEntitlement(
  current: CurrentSubscription | null,
  key: string,
): boolean {
  if (isV2SubscriptionContext(current)) {
    return hasOwn(current?.entitlements, key);
  }
  return hasResolvedEntitlement(current?.entitlements, key);
}

export function isSubscriptionEntitlementEnabled(
  current: CurrentSubscription | null,
  key: string,
  legacyFallback = false,
): boolean {
  if (isV2SubscriptionContext(current)) {
    return isEntitlementEnabled(current?.entitlements, key, false);
  }
  return isResolvedEntitlementEnabled(current?.entitlements, key, legacyFallback);
}

export function entitlementLimit(
  entitlements: EntitlementMap | null | undefined,
  key: string,
): number | null | undefined {
  const value = entitlementValue(entitlements, key);
  if (value === undefined) return undefined;
  if (value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function entitlementLabel(key: string): string {
  if (ENTITLEMENT_LABELS[key]) return ENTITLEMENT_LABELS[key];
  const last = key.split(".").filter((part) => part !== "enabled" && part !== "max").pop() || key;
  return last.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function billingIntervals(catalog: SubscriptionCatalog | null): number[] {
  if (!catalog) return [];
  const intervals = new Set<number>();
  for (const plan of catalog.plans) {
    for (const price of plan.current_version?.prices ?? []) {
      if (price.billing_interval_months) intervals.add(price.billing_interval_months);
    }
  }
  return Array.from(intervals).sort((a, b) => a - b);
}

export function pricesForInterval(
  plan: Pick<SubscriptionPlan, "current_version">,
  intervalMonths: number | null,
): {
  initial: SubscriptionPrice | null;
  renewal: SubscriptionPrice | null;
  quoteOnly: boolean;
  billingIntervalMonths: number | null;
} {
  const prices = plan.current_version?.prices ?? [];
  const exactPrices = prices.filter((price) => price.billing_interval_months === intervalMonths);
  const flexibleTermPrices = prices.filter((price) => price.billing_interval_months === null);
  const intervalPrices = exactPrices.length ? exactPrices : flexibleTermPrices;
  const initial =
    intervalPrices.find(
      (price) => (price.price_type === "initial" || price.price_type === "flat") && !price.quote_only,
    ) ?? null;
  const renewal =
    intervalPrices.find((price) => price.price_type === "renewal" && !price.quote_only) ?? null;
  const quotePrice = intervalPrices.find((price) => price.quote_only) ?? null;
  const quoteOnly = !initial && Boolean(quotePrice);
  const selectedPrice = initial ?? renewal ?? quotePrice;
  return {
    initial,
    renewal,
    quoteOnly,
    billingIntervalMonths: selectedPrice
      ? selectedPrice.billing_interval_months
      : intervalMonths,
  };
}

export function priceTypeLabel(price: SubscriptionPrice): string {
  if (price.price_type === "initial") return "Initial";
  if (price.price_type === "renewal") return "Renewal";
  return "Price";
}

export function formatPrice(amount: number | null, currency: string): string {
  if (amount == null) return "Custom quote";
  try {
    return new Intl.NumberFormat("en-NP", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export type MarketingFeature = { label: string; included: boolean };

function parseMarketingFeatures(content: unknown): MarketingFeature[] {
  const source = Array.isArray(content)
    ? content
    : content && typeof content === "object" && Array.isArray((content as { features?: unknown }).features)
      ? (content as { features: unknown[] }).features
      : [];
  return source
    .map((item): MarketingFeature | null => {
      if (typeof item === "string") return { label: item, included: true };
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = record.label ?? record.title ?? record.name;
      if (typeof label !== "string" || !label.trim()) return null;
      return { label: label.trim(), included: record.included !== false };
    })
    .filter((item): item is MarketingFeature => Boolean(item));
}

export function planFeatures(plan: SubscriptionPlan): MarketingFeature[] {
  const marketing = parseMarketingFeatures(plan.current_version?.marketing_content);
  if (marketing.length) return marketing;

  const entries = Object.entries(plan.current_version?.entitlements ?? {});
  return entries
    .map(([key, value]): MarketingFeature | null => {
      const label = entitlementLabel(key);
      if (key.endsWith(".max")) {
        if (key === "users.max") {
          if (value === null) return { label: "Unlimited users", included: true };
          const users = Number(value);
          return Number.isFinite(users) && users > 0
            ? { label: `${users.toLocaleString()} users + billing owner`, included: true }
            : null;
        }
        if (value === null) return { label: `Unlimited ${label}`, included: true };
        const limit = Number(value);
        if (!Number.isFinite(limit) || limit <= 0) return null;
        return { label: `Up to ${limit.toLocaleString()} ${label}`, included: true };
      }
      if (key === "finance.history_days") {
        if (value === null) return { label: "Unlimited finance history", included: true };
        const days = Number(value);
        return Number.isFinite(days) && days > 0
          ? { label: `${days.toLocaleString()} days of finance history`, included: true }
          : null;
      }
      if (typeof value === "boolean") return value ? { label, included: true } : null;
      return null;
    })
    .filter((item): item is MarketingFeature => Boolean(item));
}

export function requiredPlanName(
  catalog: SubscriptionCatalog | null,
  entitlementKey: string,
): string | null {
  const plan = catalog?.plans.find((candidate) =>
    isEntitlementEnabled(candidate.current_version?.entitlements, entitlementKey),
  );
  return plan?.name ?? null;
}

export function currentPlanDisplayName(
  current: CurrentSubscription | null,
  legacy?: { effective_plan?: string | null; plan_state?: string | null } | null,
): string {
  const summary = current?.subscription;
  const rawName = summary?.plan_name?.trim();
  let name = rawName || "";
  if (!name) {
    const effective = (current?.effective_plan || legacy?.effective_plan || "free").toLowerCase();
    name = effective === "free" ? "Free" : effective === "paid" || effective === "trial_paid" ? "Paid" : effective;
    name = name.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
  }
  const status = (summary?.status || current?.plan_state || legacy?.plan_state || "").toLowerCase();
  return status === "trialing" ? `${name} (Trial)` : name;
}

export function subscriptionPeriodEnd(current: CurrentSubscription | null): string | null {
  return (
    current?.subscription?.current_period_end ||
    current?.subscription?.grace_ends_at ||
    current?.trial_ends_at ||
    current?.paid_ends_at ||
    null
  );
}
