import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/lib/api-client';

export interface Restaurant {
  id: number;
  name: string;
  address: string;
  phone: string;
  timezone?: string;
  business_day_start_time?: string;
  payment_qrs?: Array<{ config_id?: string; name: string; payload: string; bank_id?: number | null }>;
  payment_cards?: Array<{ config_id?: string; name: string; identifier?: string | null; bank_id?: number | null }>;
  profile_picture: string | null;
  cover_photo: string | null;
  currency: string;
  tax_enabled: boolean;
  receipt_template: any | null;
  kot_template: any | null;
  billing_mode: string;
  effective_plan: string;
  plan_state: string;
  trial_ends_at: string | null;
  paid_ends_at: string | null;
  hotel_enabled: boolean;
  restaurant_enabled: boolean;
  finance_reports_enabled: boolean;
  finance_accounting_enabled: boolean;
  subscription?: {
    plan_code: string;
    plan_name: string;
    plan_version?: number | null;
    status: string;
    current_period_end?: string | null;
  } | null;
  entitlements?: Record<string, boolean | number | string | null>;
  usage?: Record<string, { used: number; limit: number | null; remaining: number | null }>;
  addons?: Array<Record<string, unknown>>;
}

interface RestaurantState {
  restaurant: Restaurant | null;
  loading: boolean;
  error: string | null;
  selectedModule: 'restaurant' | 'hotel' | null;
  fetchRestaurant: (force?: boolean) => Promise<void>;
  setRestaurant: (data: Restaurant | null) => void;
  clearRestaurant: () => void;
  setSelectedModule: (module: 'restaurant' | 'hotel' | null) => void;
}

let restaurantFetchPromise: Promise<void> | null = null;

export const useRestaurant = create<RestaurantState>()(
  persist(
    (set, get) => ({
      restaurant: null,
      selectedModule: null,
      loading: false,
      error: null,
      
      setRestaurant: (data) => set({ restaurant: data }),
      clearRestaurant: () => set({ restaurant: null, selectedModule: null, error: null }),
      setSelectedModule: (module) => set({ selectedModule: module }),

      fetchRestaurant: async (force = false) => {
        if (restaurantFetchPromise) {
          return restaurantFetchPromise;
        }

        restaurantFetchPromise = (async () => {
          set({ loading: true, ...(force ? { error: null } : {}) });
          try {
            const response = await apiClient.get('/restaurants/by-user');
            if (response.data.status === 'success') {
              const nextData = response.data.data;
              console.log("[useRestaurant] Full Data received:", nextData);
              console.log("[useRestaurant] Data flags check:", { id: nextData.id, hotel: nextData.hotel_enabled, rest: nextData.restaurant_enabled });
              const current = get().restaurant;

              // If we switched to a different restaurant, clear selection
              if (current && current.id !== nextData.id) {
                console.log("[useRestaurant] Restaurant changed, clearing selectedModule");
                set({ selectedModule: null });
              }

              set({ restaurant: nextData, error: null });
            }
          } catch (err: any) {
            // No restaurant yet (404) or onboarding bootstrap without pos.view (403):
            // clear stale persisted profile for onboarding/join routing.
            const status = err.response?.status;
            if (status === 404 || status === 403) {
              set({ restaurant: null, selectedModule: null, error: null });
            } else {
              console.error('Failed to fetch restaurant:', err);
              set({ error: err.response?.data?.detail || 'Failed to fetch restaurant profile' });
            }
          } finally {
            set({ loading: false });
          }
        })();

        try {
          await restaurantFetchPromise;
        } finally {
          restaurantFetchPromise = null;
        }
      },
    }),
    {
      name: 'restaurant-storage',
      partialize: (state) => ({ 
        restaurant: state.restaurant,
        selectedModule: state.selectedModule 
      }),
    }
  )
);
