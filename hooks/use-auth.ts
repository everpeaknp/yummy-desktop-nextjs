import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/api-client';
import { AuthApis } from '@/lib/api/endpoints';
import { syncAuthFromRefreshResponse } from '@/lib/auth-session';
import {
  AUTH_ZUSTAND_STORAGE_KEY,
  clearStoredTokens,
  readStoredTokens,
  writeStoredTokens,
} from '@/lib/auth-storage';
import { runAuthRecovery } from '@/lib/auth-recovery';
import { beginSessionRestore, endSessionRestore } from '@/lib/session-restore';

let bootstrapSessionPromise: Promise<void> | null = null;
import { useRestaurant } from './use-restaurant';

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
  logout: (options?: { silent?: boolean }) => void;
  me: () => Promise<void>;
  refreshSession: () => Promise<void>;
  /** Cold-start restore: sync LS ↔ zustand, refresh tokens, load user. */
  bootstrapSession: () => Promise<void>;
  syncUserProfile: () => Promise<void>;
}

function syncPersistedTokensWithState(
  set: (partial: Partial<AuthState>) => void,
  get: () => AuthState
) {
  if (typeof window === 'undefined') return;

  const { accessToken, refreshToken } = readStoredTokens();
  const state = get();

  if (!state.token && accessToken) {
    set({
      token: accessToken,
      refreshToken: refreshToken ?? state.refreshToken,
    });
  } else if (state.token || state.refreshToken) {
    writeStoredTokens(state.token, state.refreshToken);
  }
}

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
        writeStoredTokens(token, refreshToken);
      },
      setRedirecting: (isRedirecting) => set({ isRedirecting }),
      logout: (options?: { silent?: boolean }) => {
        if (!options?.silent) set({ isRedirecting: true });
        clearStoredTokens();
        set({ user: null, token: null, refreshToken: null });
        useRestaurant.getState().setSelectedModule(null);
        if (typeof window !== 'undefined') {
          const api = (window as Window & {
            electronAPI?: { clearAuthBackup?: () => Promise<void> };
          }).electronAPI;
          void api?.clearAuthBackup?.();
        }
      },
      bootstrapSession: async () => {
        if (bootstrapSessionPromise) {
          return bootstrapSessionPromise;
        }
        beginSessionRestore();
        bootstrapSessionPromise = runAuthRecovery(async () => {
          syncPersistedTokensWithState(set, get);
          await get().me();
        }).finally(() => {
          endSessionRestore();
          bootstrapSessionPromise = null;
        });
        return bootstrapSessionPromise;
      },
      refreshSession: async () => {
        return runAuthRecovery(async () => {
          const { refreshToken } = readStoredTokens();
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
        });
      },
      syncUserProfile: async () => {
        const { accessToken } = readStoredTokens();
        if (!accessToken) return;

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
        if (state.meLoading) return;

        set({ meLoading: true });
        syncPersistedTokensWithState(set, get);

        const { accessToken, refreshToken } = readStoredTokens();

        if (!accessToken && !refreshToken) {
          set({ isRedirecting: false, meLoading: false });
          return;
        }

        if (state.user) {
          set({ isRedirecting: false });
        }

        try {
          if (refreshToken) {
            try {
              const res = await apiClient.post(AuthApis.refresh, {
                refresh_token: refreshToken,
              });
              if (res.data.status === 'success') {
                syncAuthFromRefreshResponse(res.data.data);
                const restored = get().user;
                if (
                  restored?.id &&
                  (restored.restaurant_id != null ||
                    (restored.roles?.length ?? 0) > 0 ||
                    (restored.permissions?.length ?? 0) > 0)
                ) {
                  return;
                }
              }
            } catch (refreshError: any) {
              console.warn('[useAuth] Session restore via refresh token failed', refreshError);
              if (refreshError?.response?.status === 401) {
                get().logout({ silent: true });
                return;
              }
            }
          }

          const tokenAfterRefresh = readStoredTokens().accessToken;
          if (tokenAfterRefresh) {
            try {
              const base64Url = tokenAfterRefresh.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                window
                  .atob(base64)
                  .split('')
                  .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              );

              const decoded = JSON.parse(jsonPayload);
              const userId = decoded.sub || decoded.user_id || decoded.id;

              if (userId) {
                try {
                  const response = await apiClient.get(AuthApis.meProfile);
                  if (response.data.status === 'success') {
                    const p = response.data.data;
                    const roles: string[] = Array.isArray(p.roles)
                      ? p.roles
                      : p.role
                        ? [p.role]
                        : [];
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
                    set({
                      user: mappedUser,
                      token: tokenAfterRefresh,
                      refreshToken: readStoredTokens().refreshToken,
                    });
                    writeStoredTokens(
                      tokenAfterRefresh,
                      readStoredTokens().refreshToken
                    );
                  }
                } catch (error) {
                  console.warn('[useAuth] Failed to fetch /users/me/profile', error);
                }
              }
            } catch (e) {
              console.warn('[useAuth] JWT decode fallback failed', e);
            }
          }
        } catch (error) {
          console.error('[useAuth] Failed to restore session:', error);
        } finally {
          set({ isRedirecting: false, meLoading: false });
        }
      },
    }),
    {
      name: AUTH_ZUSTAND_STORAGE_KEY,
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state || typeof window === 'undefined') return;
        writeStoredTokens(state.token, state.refreshToken);
      },
    }
  )
);

/** Wait for zustand-persist rehydration before auth redirects (Electron cold start). */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = useAuth.persist;
    if (!persistApi) {
      setHydrated(true);
      return;
    }
    if (persistApi.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persistApi.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
