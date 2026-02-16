import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  roles: string[];
  primary_role: string | null;
  restaurant_id: number | null;
  currency?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isRedirecting: boolean;
  meLoading: boolean;
  setAuth: (user: User | null, token: string | null, refreshToken?: string | null) => void;
  setRedirecting: (isRedirecting: boolean) => void;
  logout: () => void;
  me: () => Promise<void>;
}

import apiClient from '@/lib/api-client';
import { AuthApis } from '@/lib/api/endpoints';

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isRedirecting: false,
      meLoading: false,
      setAuth: (user, token, refreshToken = null) => {
        set({ user, token, refreshToken, isRedirecting: false });
        if (token) localStorage.setItem('accessToken', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      },
      setRedirecting: (isRedirecting) => set({ isRedirecting }),
      logout: () => {
        set({ isRedirecting: true });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
        set({ user: null, token: null, refreshToken: null });
        // Redirection should be handled by the caller using router.push for performance
      },
      me: async () => {
        const state = get();
        // Skip if already loading
        if (state.meLoading) return;
        
        set({ meLoading: true });
        
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

        if (!token && !refreshToken) {
          set({ isRedirecting: false, meLoading: false });
          return;
        }

        // If user already exists, we might still want to refresh details, 
        // but we definitely want to stop "redirecting" loader
        if (state.user) {
          set({ isRedirecting: false });
        }

        try {
          // 1. Try to restore from Refresh Token (Best way to get full user details)
          if (refreshToken) {
            try {
              const res = await apiClient.post(AuthApis.refresh, { refresh_token: refreshToken });
              if (res.data.status === 'success') {
                const data = res.data.data;
                const roles: string[] = data.user_roles || (data.user_role ? [data.user_role] : []);
                const user: User = {
                  id: data.user_id,
                  email: data.email,
                  full_name: data.user_name,
                  role: data.user_role,
                  roles,
                  primary_role: data.primary_role || data.user_role || null,
                  restaurant_id: data.restaurant_id,
                  currency: data.currency
                };

                set({
                  user,
                  token: data.access_token,
                  refreshToken: data.refresh_token,
                  isRedirecting: false // Success, stop redirecting
                });
                localStorage.setItem('accessToken', data.access_token);
                localStorage.setItem('refreshToken', data.refresh_token);
                return;
              }
            } catch (refreshError) {
              console.warn("Session restore via refresh token failed", refreshError);
            }
          }

          // 2. Fallback to manual decode if refresh failed but valid token exists
          if (token) {
            try {
              const base64Url = token.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
              }).join(''));

              const decoded = JSON.parse(jsonPayload);
              const userId = decoded.sub || decoded.user_id || decoded.id;

              if (userId) {
                // Only Admins can fetch by ID usually, but worth a try if logged in
                const response = await apiClient.get(AuthApis.userById(userId));
                if (response.data.status === 'success') {
                  set({ user: response.data.data, isRedirecting: false });
                }
              }
            } catch (e) {
              console.warn("Manual decode fallback failed", e);
            }
          }
        } catch (error) {
          console.error("Failed to restore session:", error);
          // If everything fails, clear state
          // set({ user: null, token: null, refreshToken: null });
        } finally {
          set({ isRedirecting: false, meLoading: false });
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
