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
  permissions: string[];
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
  refreshSession: () => Promise<void>;
  /** Reload permissions (and profile fields) from /users/me/profile without rotating tokens. */
  syncUserProfile: () => Promise<void>;
}

import apiClient from '@/lib/api-client';
import { AuthApis } from '@/lib/api/endpoints';
import { syncAuthFromRefreshResponse } from '@/lib/auth-session';
import { useRestaurant } from './use-restaurant';

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
        // Clear module selection on logout
        useRestaurant.getState().setSelectedModule(null);
        // Redirection should be handled by the caller using router.push for performance
      },
      refreshSession: async () => {
        const refreshToken =
          typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        if (!refreshToken) {
          await get().me();
          return;
        }

        try {
          const res = await apiClient.post(AuthApis.refresh, {
            refresh_token: refreshToken,
          });
          if (res.data.status === 'success') {
            syncAuthFromRefreshResponse(res.data.data);
          }
        } catch (error) {
          console.warn('[useAuth] refreshSession failed', error);
          await get().me();
        }
      },
      syncUserProfile: async () => {
        const token =
          typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) return;

        try {
          const response = await apiClient.get(AuthApis.meProfile);
          if (response.data.status !== 'success') return;

          const p = response.data.data;
          const current = get().user;
          if (!current) {
            await get().me();
            return;
          }

          const roles: string[] = Array.isArray(p.roles)
            ? p.roles
            : p.role
              ? [p.role]
              : current.roles;

          set({
            user: {
              ...current,
              id: p.id ?? current.id,
              email: p.email ?? current.email,
              full_name: p.name || p.full_name || current.full_name,
              role: p.role || current.role,
              roles,
              primary_role: p.primary_role || p.role || current.primary_role,
              restaurant_id: p.restaurant_id ?? current.restaurant_id,
              currency: p.currency ?? current.currency,
              permissions: Array.isArray(p.permissions) ? p.permissions : [],
            },
          });
        } catch (error) {
          console.warn('[useAuth] syncUserProfile failed', error);
        }
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
                syncAuthFromRefreshResponse(res.data.data);
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
                try {
                  const response = await apiClient.get(AuthApis.meProfile);
                  if (response.data.status === 'success') {
                    const p = response.data.data;
                    // /users/me/profile returns: { id, name, email, role, roles, primary_role, restaurant_id, permissions }
                    // Map to our User interface which uses `full_name` not `name`
                    const roles: string[] = Array.isArray(p.roles) ? p.roles : (p.role ? [p.role] : []);
                    const mappedUser: User = {
                      id: p.id,
                      email: p.email,
                      full_name: p.name || p.full_name || '',
                      role: p.role || '',
                      roles,
                      primary_role: p.primary_role || p.role || null,
                      restaurant_id: p.restaurant_id,
                      currency: p.currency,
                      permissions: Array.isArray(p.permissions) ? p.permissions : [],
                    };
                    console.log("[useAuth] Current User (me):", { id: mappedUser.id, email: mappedUser.email, role: mappedUser.role, permissions: mappedUser.permissions?.length });
                    set({ user: mappedUser });
                  }
                } catch (error) {
                  console.warn("[useAuth] Failed to fetch user profile via /users/me/profile", error);
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
