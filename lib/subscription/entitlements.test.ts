import { describe, expect, it } from "vitest";

import {
  billingIntervals,
  currentPlanDisplayName,
  entitlementLimit,
  isResolvedEntitlementEnabled,
  isEntitlementEnabled,
  isSubscriptionEntitlementEnabled,
  planFeatures,
  priceTypeLabel,
  pricesForInterval,
  requiredPlanName,
} from "./entitlements";
import type { CurrentSubscription, SubscriptionCatalog, SubscriptionPlan } from "./types";

function plan(code: string, order: number, entitlements: Record<string, boolean | number | string | null>): SubscriptionPlan {
  return {
    id: order,
    code,
    name: code.replace(/\b\w/g, (value) => value.toUpperCase()),
    description: null,
    display_order: order,
    is_public: true,
    current_version: {
      id: `${code}-v1`,
      version_number: 1,
      status: "published",
      subtitle: null,
      marketing_content: null,
      effective_from: null,
      published_at: null,
      entitlements,
      prices: [
        { id: `${code}-initial`, billing_interval_months: 12, price_type: "initial", amount: order * 1000, currency: "NPR", tax_inclusive: false, quote_only: false },
        { id: `${code}-renewal`, billing_interval_months: 12, price_type: "renewal", amount: order * 800, currency: "NPR", tax_inclusive: false, quote_only: false },
      ],
    },
  };
}

describe("subscription entitlement helpers", () => {
  it("distinguishes missing, disabled, enabled, and unlimited values", () => {
    const entitlements = { "payroll.enabled": true, "inventory.enabled": false, "users.max": null };
    expect(isEntitlementEnabled(entitlements, "payroll.enabled")).toBe(true);
    expect(isEntitlementEnabled(entitlements, "inventory.enabled", true)).toBe(false);
    expect(isEntitlementEnabled(entitlements, "unknown.enabled", true)).toBe(true);
    expect(entitlementLimit(entitlements, "users.max")).toBeNull();
    expect(entitlementLimit(entitlements, "tables.max")).toBeUndefined();
  });

  it("uses legacy aliases only when the canonical V2 key is absent", () => {
    expect(isResolvedEntitlementEnabled({ can_manage_inventory: true }, "inventory.enabled")).toBe(true);
    expect(
      isResolvedEntitlementEnabled(
        { "inventory.enabled": false, can_manage_inventory: true },
        "inventory.enabled",
        true,
      ),
    ).toBe(false);
    expect(isResolvedEntitlementEnabled({}, "menu.modifiers.enabled", true)).toBe(true);
  });

  it("does not let a legacy fallback override a missing canonical key in V2", () => {
    const current: CurrentSubscription = {
      billing_mode: "paid",
      effective_plan: "paid",
      plan_state: "paid",
      trial_ends_at: null,
      paid_ends_at: null,
      subscription: {
        id: 9,
        billing_account_id: 4,
        plan_code: "pro",
        plan_name: "Pro",
        plan_version: 1,
        contract_plan_code: "pro",
        billing_interval_months: 12,
        status: "active",
        current_period_start: null,
        current_period_end: null,
        grace_ends_at: null,
      },
      entitlements: { can_manage_inventory: true },
      usage: {},
      addons: [],
    };
    expect(isSubscriptionEntitlementEnabled(current, "inventory.enabled", true)).toBe(false);
  });

  it("selects backend-provided billing cycles and initial/renewal prices", () => {
    const basic = plan("basic", 1, { "payroll.enabled": true });
    if (basic.current_version) basic.current_version.prices[0].price_type = "flat";
    basic.current_version?.prices.push({ id: "six", billing_interval_months: 6, price_type: "initial", amount: 7000, currency: "NPR", tax_inclusive: true, quote_only: false });
    const catalog: SubscriptionCatalog = { catalog_version: "1", currency: "NPR", plans: [basic], addons: [] };
    expect(billingIntervals(catalog)).toEqual([6, 12]);
    expect(pricesForInterval(basic, 12).initial?.amount).toBe(1000);
    expect(pricesForInterval(basic, 12).renewal?.amount).toBe(800);
    expect(priceTypeLabel(pricesForInterval(basic, 12).initial!)).toBe("Price");
  });

  it("preserves nullable terms and scopes quote pricing to the selected term", () => {
    const enterprise = plan("enterprise", 5, {});
    enterprise.current_version!.prices = [
      { id: "quote", billing_interval_months: null, price_type: "flat", amount: null, currency: "NPR", tax_inclusive: false, quote_only: true },
    ];
    expect(pricesForInterval(enterprise, 12)).toMatchObject({
      initial: null,
      quoteOnly: true,
      billingIntervalMonths: null,
    });

    const mixed = plan("mixed", 6, {});
    mixed.current_version!.prices.push(
      { id: "quote", billing_interval_months: null, price_type: "flat", amount: null, currency: "NPR", tax_inclusive: false, quote_only: true },
    );
    expect(pricesForInterval(mixed, 12).quoteOnly).toBe(false);
    expect(pricesForInterval(mixed, 12).billingIntervalMonths).toBe(12);
  });

  it("includes numeric quote-only terms in the catalog interval selector", () => {
    const enterprise = plan("enterprise", 5, {});
    enterprise.current_version!.prices = [
      { id: "quote-24", billing_interval_months: 24, price_type: "flat", amount: null, currency: "NPR", tax_inclusive: false, quote_only: true },
    ];
    const catalog: SubscriptionCatalog = { catalog_version: "1", currency: "NPR", plans: [enterprise], addons: [] };

    expect(billingIntervals(catalog)).toEqual([24]);
    expect(pricesForInterval(enterprise, 24).quoteOnly).toBe(true);
  });

  it("derives feature copy and the first eligible published plan from entitlements", () => {
    const free = plan("free", 1, { "users.max": 2, "payroll.enabled": false });
    const basic = plan("basic", 2, { "users.max": 15, "payroll.enabled": true });
    const catalog: SubscriptionCatalog = { catalog_version: "1", currency: "NPR", plans: [free, basic], addons: [] };
    expect(planFeatures(basic).map((feature) => feature.label)).toContain("15 users + billing owner");
    expect(requiredPlanName(catalog, "payroll.enabled")).toBe("Basic");
  });

  it("uses the structured current plan and adds trial status", () => {
    expect(currentPlanDisplayName({
      billing_mode: null,
      effective_plan: "trial_paid",
      plan_state: "trialing",
      trial_ends_at: null,
      paid_ends_at: null,
      subscription: {
        id: 1,
        billing_account_id: 1,
        plan_code: "pro",
        plan_name: "Pro",
        plan_version: 1,
        contract_plan_code: "pro",
        billing_interval_months: 12,
        status: "trialing",
        current_period_start: null,
        current_period_end: null,
        grace_ends_at: null,
      },
      entitlements: {},
      usage: {},
      addons: [],
    })).toBe("Pro (Trial)");
  });
});
