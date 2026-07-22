import apiClient from "@/lib/api-client";
import { SubscriptionApis } from "@/lib/api/endpoints";
import {
  normalizeCurrentSubscription,
  normalizeSubscriptionCatalog,
  normalizeSubscriptionInvoices,
  normalizeSubscriptionUsage,
  normalizeUpgradeRequest,
} from "./normalizers";
import type { UpgradeRequestPayload } from "./types";

function restaurantContext(path: string, restaurantId?: number | null): string {
  return restaurantId ? `${path}?restaurant_id=${encodeURIComponent(String(restaurantId))}` : path;
}

export const subscriptionApi = {
  async getCatalog() {
    const response = await apiClient.get(SubscriptionApis.catalog);
    return normalizeSubscriptionCatalog(response.data);
  },

  async getCurrent(restaurantId?: number | null) {
    const response = await apiClient.get(restaurantContext(SubscriptionApis.current, restaurantId));
    return normalizeCurrentSubscription(response.data);
  },

  async getUsage(restaurantId?: number | null) {
    const response = await apiClient.get(restaurantContext(SubscriptionApis.usage, restaurantId));
    return normalizeSubscriptionUsage(response.data);
  },

  async getInvoices(restaurantId?: number | null) {
    const response = await apiClient.get(restaurantContext(SubscriptionApis.invoices, restaurantId));
    return normalizeSubscriptionInvoices(response.data);
  },

  async requestUpgrade(payload: UpgradeRequestPayload, restaurantId?: number | null) {
    const response = await apiClient.post(
      restaurantContext(SubscriptionApis.upgradeRequests, restaurantId),
      payload,
    );
    return normalizeUpgradeRequest(response.data);
  },
};

export type SubscriptionApi = typeof subscriptionApi;
