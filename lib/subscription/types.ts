export type EntitlementValue = boolean | number | string | null;

export type EntitlementMap = Record<string, EntitlementValue>;

export type SubscriptionStatus =
  | "scheduled"
  | "pending_payment"
  | "trialing"
  | "active"
  | "grace"
  | "past_due"
  | "expired"
  | "canceled"
  | string;

export type SubscriptionPrice = {
  id: number | string;
  billing_interval_months: number | null;
  price_type: "flat" | "initial" | "renewal" | string;
  amount: number | null;
  currency: string;
  tax_inclusive: boolean;
  quote_only: boolean;
};

export type SubscriptionPlanVersion = {
  id: number | string;
  version_number: number;
  status: "draft" | "published" | "retired" | string;
  subtitle: string | null;
  marketing_content: unknown;
  effective_from: string | null;
  published_at: string | null;
  prices: SubscriptionPrice[];
  entitlements: EntitlementMap;
};

export type SubscriptionPlan = {
  id: number | string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
  is_public: boolean;
  current_version: SubscriptionPlanVersion | null;
};

export type CatalogAddon = {
  id: number | string;
  code: string;
  name: string;
  description: string | null;
  is_public: boolean;
  status: string | null;
  compatible_plan_codes: string[];
  current_version: SubscriptionPlanVersion | null;
  raw: Record<string, unknown>;
};

export type SubscriptionCatalog = {
  catalog_version: string;
  currency: string;
  plans: SubscriptionPlan[];
  addons: CatalogAddon[];
};

export type CurrentSubscriptionSummary = {
  id: number | string | null;
  billing_account_id: number | string | null;
  plan_code: string;
  plan_name: string;
  plan_version: number | null;
  contract_plan_code: string | null;
  billing_interval_months: number | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
};

export type SubscriptionUsage = {
  used: number;
  limit: number | null;
  remaining: number | null;
};

export type SubscriptionUsageMap = Record<string, SubscriptionUsage>;

export type CurrentAddon = {
  id: number | string | null;
  code: string;
  name: string;
  version: number | null;
  status: string | null;
  ends_at: string | null;
  configuration: Record<string, unknown>;
  raw: Record<string, unknown>;
};

export type CurrentSubscription = {
  billing_mode: string | null;
  effective_plan: string | null;
  plan_state: string | null;
  trial_ends_at: string | null;
  paid_ends_at: string | null;
  subscription: CurrentSubscriptionSummary | null;
  entitlements: EntitlementMap;
  usage: SubscriptionUsageMap;
  addons: CurrentAddon[];
};

export type UpgradeRequestPayload = {
  requested_plan_code: string;
  billing_interval_months?: number | null;
  requested_addon_codes?: string[];
  message?: string | null;
};

export type UpgradeRequest = Omit<UpgradeRequestPayload, "billing_interval_months"> & {
  id: number | string;
  status: string;
  billing_interval_months: number | null;
  created_at: string | null;
};

export type SubscriptionInvoice = {
  id: number | string;
  invoice_number: string;
  status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  due_at: string | null;
  period_start: string | null;
  period_end: string | null;
  source: string;
  line_items: Array<Record<string, unknown>>;
  created_at: string | null;
};

export type BaseResponse<T> = {
  status?: string;
  message?: string;
  data?: T;
};
