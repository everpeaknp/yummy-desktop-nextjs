import { create } from 'zustand';
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
  fetchRestaurant: () => Promise<void>;
}

export const useRestaurant = create<RestaurantState>((set) => ({
  restaurant: null,
  loading: false,
  error: null,
  fetchRestaurant: async () => {
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
}));
