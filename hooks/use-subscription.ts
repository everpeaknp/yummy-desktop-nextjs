"use client";

import { create } from "zustand";

import { subscriptionApi } from "@/lib/subscription/api";
import {
  hasResolvedSubscriptionEntitlement,
  isSubscriptionEntitlementEnabled,
  requiredPlanName,
} from "@/lib/subscription/entitlements";
import type {
  CurrentSubscription,
  SubscriptionCatalog,
  SubscriptionInvoice,
  SubscriptionUsageMap,
  UpgradeRequest,
  UpgradeRequestPayload,
} from "@/lib/subscription/types";
import { getApiErrorMessage } from "@/lib/api-error-message";

function errorMessage(error: unknown, fallback: string): string {
  const apiMessage = getApiErrorMessage(error, "");
  if (apiMessage) return apiMessage;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

type FetchOptions = { force?: boolean; restaurantId?: number | null };

interface SubscriptionState {
  catalog: SubscriptionCatalog | null;
  current: CurrentSubscription | null;
  usage: SubscriptionUsageMap;
  invoices: SubscriptionInvoice[];
  contextRestaurantId: number | null;
  catalogLoading: boolean;
  currentLoading: boolean;
  usageLoading: boolean;
  invoicesLoading: boolean;
  requestLoading: boolean;
  catalogError: string | null;
  currentError: string | null;
  usageError: string | null;
  invoicesError: string | null;
  requestError: string | null;
  fetchCatalog: (options?: FetchOptions) => Promise<SubscriptionCatalog | null>;
  fetchCurrent: (options?: FetchOptions) => Promise<CurrentSubscription | null>;
  fetchUsage: (options?: FetchOptions) => Promise<SubscriptionUsageMap>;
  fetchInvoices: (options?: FetchOptions) => Promise<SubscriptionInvoice[]>;
  refreshAll: (options?: FetchOptions) => Promise<void>;
  requestUpgrade: (payload: UpgradeRequestPayload) => Promise<UpgradeRequest>;
  clearCurrent: () => void;
  reset: () => void;
}

const emptyCustomerState = {
  current: null,
  usage: {},
  invoices: [],
  contextRestaurantId: null,
  currentLoading: false,
  usageLoading: false,
  invoicesLoading: false,
  currentError: null,
  usageError: null,
  invoicesError: null,
  requestError: null,
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  catalog: null,
  current: null,
  usage: {},
  invoices: [],
  contextRestaurantId: null,
  catalogLoading: false,
  currentLoading: false,
  usageLoading: false,
  invoicesLoading: false,
  requestLoading: false,
  catalogError: null,
  currentError: null,
  usageError: null,
  invoicesError: null,
  requestError: null,

  fetchCatalog: async ({ force = false } = {}) => {
    const state = get();
    if (state.catalog && !force) return state.catalog;
    if (state.catalogLoading && !force) return state.catalog;
    set({ catalogLoading: true, catalogError: null });
    try {
      const catalog = await subscriptionApi.getCatalog();
      set({ catalog, catalogLoading: false, catalogError: null });
      return catalog;
    } catch (error) {
      set({
        catalogLoading: false,
        catalogError: errorMessage(error, "Unable to load subscription plans."),
      });
      throw error;
    }
  },

  fetchCurrent: async ({ force = false, restaurantId = null } = {}) => {
    const state = get();
    const changedRestaurant = state.contextRestaurantId !== restaurantId;
    if (state.current && !force && !changedRestaurant) return state.current;
    if (state.currentLoading && !force && !changedRestaurant) return state.current;

    set({
      contextRestaurantId: restaurantId,
      current: changedRestaurant ? null : state.current,
      usage: changedRestaurant ? {} : state.usage,
      invoices: changedRestaurant ? [] : state.invoices,
      currentLoading: true,
      currentError: null,
    });
    try {
      const current = await subscriptionApi.getCurrent(restaurantId);
      if (get().contextRestaurantId === restaurantId) {
        set({
          current,
          usage: Object.keys(current.usage).length ? current.usage : get().usage,
          currentLoading: false,
          currentError: null,
        });
      }
      return current;
    } catch (error) {
      if (get().contextRestaurantId === restaurantId) {
        set({
          currentLoading: false,
          currentError: errorMessage(error, "Unable to load the current subscription."),
        });
      }
      throw error;
    }
  },

  fetchUsage: async ({ restaurantId = null } = {}) => {
    if (get().contextRestaurantId !== restaurantId) {
      set({ ...emptyCustomerState, contextRestaurantId: restaurantId });
    }
    set({ usageLoading: true, usageError: null });
    try {
      const usage = await subscriptionApi.getUsage(restaurantId);
      if (get().contextRestaurantId === restaurantId) {
        set({ usage, usageLoading: false, usageError: null });
      }
      return usage;
    } catch (error) {
      if (get().contextRestaurantId === restaurantId) {
        set({
          usageLoading: false,
          usageError: errorMessage(error, "Unable to load current plan usage."),
        });
      }
      throw error;
    }
  },

  fetchInvoices: async ({ restaurantId = null } = {}) => {
    if (get().contextRestaurantId !== restaurantId) {
      set({ ...emptyCustomerState, contextRestaurantId: restaurantId });
    }
    set({ invoicesLoading: true, invoicesError: null });
    try {
      const invoices = await subscriptionApi.getInvoices(restaurantId);
      if (get().contextRestaurantId === restaurantId) {
        set({ invoices, invoicesLoading: false, invoicesError: null });
      }
      return invoices;
    } catch (error) {
      if (get().contextRestaurantId === restaurantId) {
        set({
          invoicesLoading: false,
          invoicesError: errorMessage(error, "Unable to load billing history."),
        });
      }
      throw error;
    }
  },

  refreshAll: async (options = {}) => {
    await Promise.allSettled([
      get().fetchCatalog(options),
      get().fetchCurrent(options),
      get().fetchUsage(options),
      get().fetchInvoices(options),
    ]);
  },

  requestUpgrade: async (payload) => {
    set({ requestLoading: true, requestError: null });
    try {
      const request = await subscriptionApi.requestUpgrade(payload, get().contextRestaurantId);
      set({ requestLoading: false, requestError: null });
      return request;
    } catch (error) {
      set({
        requestLoading: false,
        requestError: errorMessage(error, "Unable to save the plan request."),
      });
      throw error;
    }
  },

  clearCurrent: () => set(emptyCustomerState),
  reset: () =>
    set({
      ...emptyCustomerState,
      catalog: null,
      catalogLoading: false,
      requestLoading: false,
      catalogError: null,
    }),
}));

export function useEntitlement(entitlementKey: string, legacyFallback = false) {
  const entitlements = useSubscriptionStore((state) => state.current?.entitlements);
  const current = useSubscriptionStore((state) => state.current);
  const loading = useSubscriptionStore((state) => state.currentLoading);
  const error = useSubscriptionStore((state) => state.currentError);
  const resolved = hasResolvedSubscriptionEntitlement(current, entitlementKey);
  return {
    allowed: isSubscriptionEntitlementEnabled(current, entitlementKey, legacyFallback),
    resolved,
    loading: !current && !error && (loading || !resolved),
    error,
  };
}

export function useRequiredPlanName(entitlementKey: string): string | null {
  const catalog = useSubscriptionStore((state) => state.catalog);
  return requiredPlanName(catalog, entitlementKey);
}
