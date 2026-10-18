import apiClient from "@/lib/api-client";
import { SubscriptionApis } from "@/lib/api/endpoints";
import {
  normalizeCurrentSubscription,
  normalizeSubscriptionCatalog,
  normalizeSubscriptionInvoices,
  normalizeSubscriptionUsage,
  normalizeUpgradeRequest,
} from "./normalizers";
import type { SubscriptionCheckoutPayload, SubscriptionFonepayCheckout, UpgradeRequestPayload } from "./types";

function restaurantContext(path: string, restaurantId?: number | null): string {
  return restaurantId ? `${path}?restaurant_id=${encodeURIComponent(String(restaurantId))}` : path;
}

export const subscriptionApi = {
  async requestAddonQuote(addonCode: string, restaurantId?: number | null) {
    const response = await apiClient.post(restaurantContext("/subscriptions/addon-quote-requests", restaurantId), { addon_code: addonCode });
    return response.data.data;
  },
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

  async resolveQuotaCompliance(payload: { table_ids: number[]; menu_item_ids: number[]; user_ids: number[] }, restaurantId?: number | null) {
    const response = await apiClient.post(restaurantContext(SubscriptionApis.quotaCompliance, restaurantId), payload);
    return response.data;
  },

  async createCheckout(payload: SubscriptionCheckoutPayload, restaurantId?: number | null): Promise<SubscriptionFonepayCheckout> {
    const response = await apiClient.post(
      restaurantContext(SubscriptionApis.checkout, restaurantId),
      payload,
    );
    return response.data.data;
  },

  async startFonepayCheckout(invoiceId: number | string, restaurantId?: number | null): Promise<SubscriptionFonepayCheckout> {
    const response = await apiClient.post(restaurantContext(SubscriptionApis.fonepayCheckout(invoiceId), restaurantId));
    return response.data.data;
  },

  async verifyFonepayCheckout(invoiceId: number | string, prn: string, restaurantId?: number | null): Promise<SubscriptionFonepayCheckout> {
    const response = await apiClient.post(restaurantContext(SubscriptionApis.fonepayVerify(invoiceId, prn), restaurantId));
    return response.data.data;
  },

  async supersedeFonepayCheckout(invoiceId: number | string, prn: string, restaurantId?: number | null): Promise<SubscriptionFonepayCheckout> {
    const response = await apiClient.post(restaurantContext(SubscriptionApis.fonepaySupersede(invoiceId, prn), restaurantId));
    return response.data.data;
  },
};

export type SubscriptionApi = typeof subscriptionApi;
