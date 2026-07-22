import type {
  BaseResponse,
  CatalogAddon,
  CurrentAddon,
  CurrentSubscription,
  CurrentSubscriptionSummary,
  EntitlementMap,
  EntitlementValue,
  SubscriptionCatalog,
  SubscriptionPlan,
  SubscriptionPlanVersion,
  SubscriptionPrice,
  SubscriptionInvoice,
  SubscriptionUsage,
  SubscriptionUsageMap,
  UpgradeRequest,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asNullableString(value: unknown): string | null {
  const result = asString(value).trim();
  return result || null;
}

function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asId(value: unknown, fallback: number | string): number | string {
  return typeof value === "number" || typeof value === "string" ? value : fallback;
}

export function unwrapSubscriptionResponse<T>(payload: BaseResponse<T> | T): T {
  if (isRecord(payload) && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data as T;
  }
  return payload as T;
}

function normalizeEntitlementValue(value: unknown): EntitlementValue | undefined {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

export function normalizeEntitlements(value: unknown): EntitlementMap {
  if (!isRecord(value)) return {};
  const entitlements: EntitlementMap = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const normalized = normalizeEntitlementValue(rawValue);
    if (normalized !== undefined) entitlements[key] = normalized;
  }
  return entitlements;
}

function normalizePrice(value: unknown, index: number): SubscriptionPrice | null {
  if (!isRecord(value)) return null;
  const interval = value.billing_interval_months;
  const parsedInterval = interval == null ? null : asNumber(interval, Number.NaN);
  const rawAmount = value.amount;
  const parsedAmount = rawAmount == null ? null : asNumber(rawAmount, Number.NaN);
  return {
    id: asId(value.id, `price-${index}`),
    billing_interval_months: parsedInterval !== null && Number.isFinite(parsedInterval) ? parsedInterval : null,
    price_type: asString(value.price_type, "flat").toLowerCase(),
    amount: parsedAmount !== null && Number.isFinite(parsedAmount) ? parsedAmount : null,
    currency: asString(value.currency, "NPR").toUpperCase(),
    tax_inclusive: value.tax_inclusive === true,
    quote_only: value.quote_only === true,
  };
}

function normalizeVersion(value: unknown, fallbackId: number | string): SubscriptionPlanVersion | null {
  if (!isRecord(value)) return null;
  const prices = Array.isArray(value.prices)
    ? value.prices.map(normalizePrice).filter((price): price is SubscriptionPrice => Boolean(price))
    : [];
  return {
    id: asId(value.id, fallbackId),
    version_number: asNumber(value.version_number, 1),
    status: asString(value.status, "published").toLowerCase(),
    subtitle: asNullableString(value.subtitle),
    marketing_content: value.marketing_content ?? null,
    effective_from: asNullableString(value.effective_from),
    published_at: asNullableString(value.published_at),
    prices,
    entitlements: normalizeEntitlements(value.entitlements),
  };
}

function normalizePlan(value: unknown, index: number): SubscriptionPlan | null {
  if (!isRecord(value)) return null;
  const id = asId(value.id, `plan-${index}`);
  const code = asString(value.code ?? value.id, `plan-${index}`).trim().toLowerCase();
  if (!code) return null;
  return {
    id,
    code,
    name: asString(value.name, code),
    description: asNullableString(value.description),
    display_order: asNumber(value.display_order, index),
    is_public: value.is_public !== false,
    current_version: normalizeVersion(value.current_version, `${String(id)}-version`),
  };
}

function normalizeCatalogAddon(value: unknown, index: number): CatalogAddon | null {
  if (!isRecord(value)) return null;
  const code = asString(value.code ?? value.id, `addon-${index}`).trim().toLowerCase();
  if (!code) return null;
  return {
    id: asId(value.id, `addon-${index}`),
    code,
    name: asString(value.name, code),
    description: asNullableString(value.description),
    is_public: value.is_public !== false,
    status: asNullableString(value.status),
    compatible_plan_codes: Array.isArray(value.compatible_plan_codes)
      ? value.compatible_plan_codes.map(String)
      : [],
    current_version: normalizeVersion(value.current_version, `addon-${index}-version`),
    raw: value,
  };
}

export function normalizeSubscriptionCatalog(payload: unknown): SubscriptionCatalog {
  const data = unwrapSubscriptionResponse(payload as BaseResponse<unknown>);
  if (!isRecord(data)) throw new Error("The subscription catalog response is invalid.");
  const plans = Array.isArray(data.plans)
    ? data.plans.map(normalizePlan).filter((plan): plan is SubscriptionPlan => Boolean(plan))
    : [];
  return {
    catalog_version: asString(data.catalog_version, "unknown"),
    currency: asString(data.currency, "NPR").toUpperCase(),
    plans: plans
      .filter((plan) => plan.is_public && plan.current_version)
      .sort((a, b) => a.display_order - b.display_order),
    addons: Array.isArray(data.addons)
      ? data.addons
          .map(normalizeCatalogAddon)
          .filter(
            (addon): addon is CatalogAddon =>
              Boolean(addon?.is_public && addon.current_version),
          )
      : [],
  };
}

function normalizeUsageEntry(value: unknown): SubscriptionUsage | null {
  if (!isRecord(value)) return null;
  const used = asNumber(value.used, 0);
  const limit = value.limit == null ? null : asNumber(value.limit, Number.NaN);
  const remaining = value.remaining == null ? null : asNumber(value.remaining, Number.NaN);
  return {
    used,
    limit: limit !== null && Number.isFinite(limit) ? limit : null,
    remaining: remaining !== null && Number.isFinite(remaining) ? remaining : null,
  };
}

export function normalizeSubscriptionUsage(payload: unknown): SubscriptionUsageMap {
  const unwrapped = unwrapSubscriptionResponse(payload as BaseResponse<unknown>);
  const data = isRecord(unwrapped) && isRecord(unwrapped.usage) ? unwrapped.usage : unwrapped;
  if (!isRecord(data)) return {};
  const usage: SubscriptionUsageMap = {};
  for (const [key, rawValue] of Object.entries(data)) {
    const normalized = normalizeUsageEntry(rawValue);
    if (normalized) usage[key] = normalized;
  }
  return usage;
}

function normalizeSummary(value: unknown): CurrentSubscriptionSummary | null {
  if (!isRecord(value)) return null;
  const planCode = asString(value.plan_code).trim().toLowerCase();
  if (!planCode) return null;
  const rawVersion = value.plan_version;
  return {
    id: value.id == null ? null : asId(value.id, ""),
    billing_account_id:
      value.billing_account_id == null ? null : asId(value.billing_account_id, ""),
    plan_code: planCode,
    plan_name: asString(value.plan_name, planCode),
    plan_version: rawVersion == null ? null : asNumber(rawVersion, 0),
    contract_plan_code: asNullableString(value.contract_plan_code),
    billing_interval_months:
      value.billing_interval_months == null
        ? null
        : asNumber(value.billing_interval_months, 0),
    status: asString(value.status, "active").toLowerCase(),
    current_period_start: asNullableString(value.current_period_start),
    current_period_end: asNullableString(value.current_period_end),
    grace_ends_at: asNullableString(value.grace_ends_at),
  };
}

function normalizeCurrentAddon(value: unknown, index: number): CurrentAddon | null {
  if (!isRecord(value)) return null;
  const code = asString(value.code ?? value.addon_code ?? value.id, `addon-${index}`).toLowerCase();
  return {
    id:
      value.id == null && value.assignment_id == null
        ? null
        : asId(value.id ?? value.assignment_id, `addon-${index}`),
    code,
    name: asString(value.name ?? value.addon_name, code),
    version: value.version == null ? null : asNumber(value.version, 0),
    status: asNullableString(value.status),
    ends_at: asNullableString(value.ends_at),
    configuration: isRecord(value.configuration) ? value.configuration : {},
    raw: value,
  };
}

export function normalizeCurrentSubscription(payload: unknown): CurrentSubscription {
  const data = unwrapSubscriptionResponse(payload as BaseResponse<unknown>);
  if (!isRecord(data)) throw new Error("The current subscription response is invalid.");
  return {
    billing_mode: asNullableString(data.billing_mode),
    effective_plan: asNullableString(data.effective_plan),
    plan_state: asNullableString(data.plan_state),
    trial_ends_at: asNullableString(data.trial_ends_at),
    paid_ends_at: asNullableString(data.paid_ends_at),
    subscription: normalizeSummary(data.subscription),
    entitlements: normalizeEntitlements(data.entitlements),
    usage: normalizeSubscriptionUsage(data.usage),
    addons: Array.isArray(data.addons)
      ? data.addons.map(normalizeCurrentAddon).filter((addon): addon is CurrentAddon => Boolean(addon))
      : [],
  };
}

export function normalizeUpgradeRequest(payload: unknown): UpgradeRequest {
  const data = unwrapSubscriptionResponse(payload as BaseResponse<unknown>);
  if (!isRecord(data)) throw new Error("The upgrade request response is invalid.");
  return {
    id: asId(data.id, "pending"),
    status: asString(data.status, "pending"),
    requested_plan_code: asString(data.requested_plan_code),
    billing_interval_months:
      data.billing_interval_months == null
        ? null
        : asNumber(data.billing_interval_months, 12),
    requested_addon_codes: Array.isArray(data.requested_addon_codes)
      ? data.requested_addon_codes.map(String)
      : [],
    message: asNullableString(data.message),
    created_at: asNullableString(data.created_at),
  };
}

function normalizeInvoice(value: unknown, index: number): SubscriptionInvoice | null {
  if (!isRecord(value)) return null;
  return {
    id: asId(value.id, `invoice-${index}`),
    invoice_number: asString(value.invoice_number, `Invoice ${index + 1}`),
    status: asString(value.status, "issued").toLowerCase(),
    currency: asString(value.currency, "NPR").toUpperCase(),
    subtotal: asNumber(value.subtotal, 0),
    discount_amount: asNumber(value.discount_amount, 0),
    tax_amount: asNumber(value.tax_amount, 0),
    total_amount: asNumber(value.total_amount, 0),
    amount_paid: asNumber(value.amount_paid, 0),
    amount_due: asNumber(value.amount_due, 0),
    due_at: asNullableString(value.due_at),
    period_start: asNullableString(value.period_start),
    period_end: asNullableString(value.period_end),
    source: asString(value.source, "manual"),
    line_items: Array.isArray(value.line_items)
      ? value.line_items.filter(isRecord)
      : [],
    created_at: asNullableString(value.created_at),
  };
}

export function normalizeSubscriptionInvoices(payload: unknown): SubscriptionInvoice[] {
  const data = unwrapSubscriptionResponse(payload as BaseResponse<unknown>);
  return Array.isArray(data)
    ? data.map(normalizeInvoice).filter((invoice): invoice is SubscriptionInvoice => Boolean(invoice))
    : [];
}
