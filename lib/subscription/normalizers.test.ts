import { describe, expect, it } from "vitest";

import {
  normalizeCurrentSubscription,
  normalizeSubscriptionCatalog,
  normalizeSubscriptionInvoices,
  normalizeSubscriptionUsage,
  normalizeUpgradeRequest,
} from "./normalizers";

describe("subscription response normalizers", () => {
  it("unwraps the API envelope and normalizes decimal-string prices", () => {
    const catalog = normalizeSubscriptionCatalog({
      status: "success",
      data: {
        catalog_version: "2026-07-22.1",
        currency: "NPR",
        plans: [
          {
            id: 2,
            code: "basic",
            name: "Basic",
            display_order: 2,
            is_public: true,
            current_version: {
              id: 22,
              version_number: 1,
              status: "published",
              prices: [
                {
                  id: 9,
                  billing_interval_months: 12,
                  price_type: "initial",
                  amount: "11400.00",
                  currency: "NPR",
                  tax_inclusive: true,
                  quote_only: false,
                },
              ],
              entitlements: { "users.max": 15, "payroll.enabled": true },
            },
          },
        ],
        addons: [
          {
            id: 5,
            code: "attendance",
            name: "Attendance",
            compatible_plan_codes: ["basic", "pro"],
            current_version: {
              id: 55,
              version_number: 1,
              status: "published",
              prices: [{ id: 56, billing_interval_months: 12, price_type: "flat", amount: "5000" }],
              entitlements: { "attendance.mobile.enabled": true },
            },
          },
          {
            id: 6,
            code: "unpublished",
            name: "Unpublished add-on",
            current_version: null,
          },
        ],
      },
    });

    expect(catalog.catalog_version).toBe("2026-07-22.1");
    expect(catalog.plans[0].current_version?.prices[0].amount).toBe(11400);
    expect(catalog.plans[0].current_version?.entitlements).toEqual({
      "users.max": 15,
      "payroll.enabled": true,
    });
    expect(catalog.addons[0].current_version?.prices[0].amount).toBe(5000);
    expect(catalog.addons[0].compatible_plan_codes).toEqual(["basic", "pro"]);
    expect(catalog.addons).toHaveLength(1);
  });

  it("normalizes current plan, add-ons, and unlimited usage", () => {
    const current = normalizeCurrentSubscription({
      data: {
        subscription: {
          id: 8,
          billing_account_id: 4,
          plan_code: "premium",
          plan_name: "Premium",
          plan_version: 3,
          status: "active",
          current_period_end: "2027-07-22T00:00:00Z",
        },
        entitlements: { "users.max": null, "business.multi_location.enabled": true },
        usage: { "users.max": { used: 18, limit: null, remaining: null } },
        addons: [{ assignment_id: 3, code: "attendance", name: "Attendance", version: 2, status: "active" }],
      },
    });

    expect(current.subscription?.plan_code).toBe("premium");
    expect(current.entitlements["users.max"]).toBeNull();
    expect(current.usage["users.max"]).toEqual({ used: 18, limit: null, remaining: null });
    expect(current.addons[0].name).toBe("Attendance");
    expect(current.addons[0].id).toBe(3);
    expect(current.addons[0].version).toBe(2);
  });

  it("accepts both direct usage and a nested usage object", () => {
    expect(normalizeSubscriptionUsage({ data: { "tables.max": { used: 4, limit: 15, remaining: 11 } } })).toEqual({
      "tables.max": { used: 4, limit: 15, remaining: 11 },
    });
    expect(normalizeSubscriptionUsage({ usage: { "menu_items.max": { used: 10, limit: 50, remaining: 40 } } })).toEqual({
      "menu_items.max": { used: 10, limit: 50, remaining: 40 },
    });
  });

  it("rejects a malformed catalog instead of inventing fallback pricing", () => {
    expect(() => normalizeSubscriptionCatalog(null)).toThrow("subscription catalog response is invalid");
  });

  it("preserves a null billing interval for an Enterprise quote request", () => {
    expect(normalizeUpgradeRequest({
      data: {
        id: 10,
        status: "pending",
        requested_plan_code: "enterprise",
        billing_interval_months: null,
      },
    }).billing_interval_months).toBeNull();
  });

  it("normalizes customer invoice amounts and line items", () => {
    const invoices = normalizeSubscriptionInvoices({ data: [{
      id: 7,
      invoice_number: "INV-7",
      status: "partially_paid",
      currency: "npr",
      subtotal: "11400.00",
      discount_amount: "400.00",
      tax_amount: "1430.00",
      total_amount: "12430.00",
      amount_paid: "5000.00",
      amount_due: "7430.00",
      line_items: [{ kind: "plan", code: "basic" }],
    }] });

    expect(invoices[0]).toMatchObject({
      invoice_number: "INV-7",
      currency: "NPR",
      total_amount: 12430,
      amount_due: 7430,
    });
    expect(invoices[0].line_items).toHaveLength(1);
  });
});
