import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import apiClient from "@/lib/api-client";
import { subscriptionApi } from "./api";

const mocked = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.resetAllMocks();
  mocked.get.mockResolvedValue({ data: { data: { plans: [], addons: [] } } });
  mocked.post.mockResolvedValue({
    data: {
      data: {
        id: 1,
        status: "pending",
        requested_plan_code: "pro",
        billing_interval_months: 12,
        requested_addon_codes: [],
      },
    },
  });
});

describe("subscriptionApi", () => {
  it("uses the Subscription V2 customer endpoints", async () => {
    await subscriptionApi.getCatalog();
    mocked.get.mockResolvedValueOnce({ data: { data: {} } });
    await subscriptionApi.getCurrent();
    mocked.get.mockResolvedValueOnce({ data: { data: {} } });
    await subscriptionApi.getUsage();
    mocked.get.mockResolvedValueOnce({ data: { data: [] } });
    await subscriptionApi.getInvoices();
    await subscriptionApi.requestUpgrade({
      requested_plan_code: "pro",
      billing_interval_months: 12,
      requested_addon_codes: ["attendance"],
    });

    expect(mocked.get).toHaveBeenNthCalledWith(1, "/subscriptions/catalog");
    expect(mocked.get).toHaveBeenNthCalledWith(2, "/subscriptions/current");
    expect(mocked.get).toHaveBeenNthCalledWith(3, "/subscriptions/usage");
    expect(mocked.get).toHaveBeenNthCalledWith(4, "/subscriptions/invoices");
    expect(mocked.post).toHaveBeenCalledWith("/subscriptions/upgrade-requests", {
      requested_plan_code: "pro",
      billing_interval_months: 12,
      requested_addon_codes: ["attendance"],
    });
  });

  it("keeps subscription reads and requests in the selected restaurant context", async () => {
    mocked.get.mockResolvedValue({ data: { data: {} } });
    await subscriptionApi.getCurrent(42);
    await subscriptionApi.getUsage(42);
    await subscriptionApi.getInvoices(42);
    await subscriptionApi.requestUpgrade(
      { requested_plan_code: "enterprise", billing_interval_months: null },
      42,
    );

    expect(mocked.get).toHaveBeenCalledWith("/subscriptions/current?restaurant_id=42");
    expect(mocked.get).toHaveBeenCalledWith("/subscriptions/usage?restaurant_id=42");
    expect(mocked.get).toHaveBeenCalledWith("/subscriptions/invoices?restaurant_id=42");
    expect(mocked.post).toHaveBeenCalledWith(
      "/subscriptions/upgrade-requests?restaurant_id=42",
      { requested_plan_code: "enterprise", billing_interval_months: null },
    );
  });
});
