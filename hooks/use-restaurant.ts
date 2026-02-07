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
}

interface RestaurantState {
  restaurant: Restaurant | null;
  loading: boolean;
  error: string | null;
  fetchRestaurant: (force?: boolean) => Promise<void>;
  setRestaurant: (data: Restaurant) => void;
}

export const useRestaurant = create<RestaurantState>()(
  persist(
    (set, get) => ({
      restaurant: null,
      loading: false,
      error: null,
      
      setRestaurant: (data) => set({ restaurant: data }),

      fetchRestaurant: async (force = false) => {
        // If we already have data and not forcing refresh, return (optional optimization, but user wants FRESH data usually? 
        // Actually, for "fast" feeling, we rely on cached data first, but maybe refetch in background.
        // For now, simple persist is huge improvement.
        
        set({ loading: true });
        try {
          const response = await apiClient.get('/restaurants/by-user');
          if (response.data.status === 'success') {
            set({ restaurant: response.data.data, error: null });
          }
        } catch (err: any) {
          console.error('Failed to fetch restaurant:', err);
          set({ error: err.response?.data?.detail || 'Failed to fetch restaurant profile' });
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: 'restaurant-storage', // name of item in the storage (must be unique)
      partialize: (state) => ({ restaurant: state.restaurant }), // Only persist the data, not loading/error
    }
  )
);
