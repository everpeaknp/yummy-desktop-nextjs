import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/lib/api-client';

interface Restaurant {
  id: number;
  name: string;
  address: string;
  phone: string;
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
}

interface RestaurantState {
  restaurant: Restaurant | null;
  loading: boolean;
  error: string | null;
  selectedModule: 'restaurant' | 'hotel' | null;
  fetchRestaurant: (force?: boolean) => Promise<void>;
  setRestaurant: (data: Restaurant) => void;
  setSelectedModule: (module: 'restaurant' | 'hotel' | null) => void;
}

export const useRestaurant = create<RestaurantState>()(
  persist(
    (set, get) => ({
      restaurant: null,
      selectedModule: null,
      loading: false,
      error: null,
      
      setRestaurant: (data) => set({ restaurant: data }),
      setSelectedModule: (module) => set({ selectedModule: module }),

      fetchRestaurant: async (force = false) => {
        // If we already have data and not forcing refresh, return (optional optimization, but user wants FRESH data usually? 
        // Actually, for "fast" feeling, we rely on cached data first, but maybe refetch in background.
        // For now, simple persist is huge improvement.
        
        set({ loading: true });
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
          // If the user hasn't created or been assigned a restaurant yet, the backend correctly returns 404.
          // We don't need to log this as a critical error in the console.
          if (err.response?.status !== 404) {
            console.error('Failed to fetch restaurant:', err);
          }
          set({ error: err.response?.data?.detail || 'Failed to fetch restaurant profile' });
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'restaurant-storage', // name of item in the storage (must be unique)
      partialize: (state) => ({ 
        restaurant: state.restaurant,
        selectedModule: state.selectedModule 
      }), // Only persist the data and selection
    }
  )
);
