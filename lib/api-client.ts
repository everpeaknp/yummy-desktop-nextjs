import axios from 'axios';
import { syncAuthFromRefreshResponse } from '@/lib/auth-session';
import { clearStoredTokens, readStoredTokens } from '@/lib/auth-storage';
import { isAuthRecoveryActive } from '@/lib/auth-recovery';

const getApiBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.yummyever.com';
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && envUrl.startsWith('http://')) {
    return envUrl.replace('http://', 'https://');
  }
  return envUrl;
};

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const PROXY_BASE = '/api/proxy';

const apiClient = axios.create({
  // In local dev we proxy API calls through Next.js rewrites to avoid CORS when hitting a remote backend.
  baseURL: isLocalhost ? PROXY_BASE : getApiBaseUrl(),
});

// Request Interceptor: Attach Token
apiClient.interceptors.request.use(
  (config) => {
    config.baseURL = isLocalhost ? PROXY_BASE : getApiBaseUrl();
    // TODO: Get token from Zustand store or localStorage
    const token =
      typeof window !== 'undefined' ? readStoredTokens().accessToken : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto-refresh token on 401, then retry
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh for auth endpoints themselves
      const url = originalRequest.url || '';
      if (
        url.includes('/auth/login') ||
        url.includes('/auth/refresh') ||
        url.includes('/auth/firebase/google') ||
        url.includes('/auth/firebase/apple')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            originalRequest._retry = true;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken =
          typeof window !== 'undefined' ? readStoredTokens().refreshToken : null;
        if (!refreshToken) throw new Error('No refresh token');

        const refreshBase = isLocalhost ? PROXY_BASE : getApiBaseUrl();
        const res = await axios.post(`${refreshBase}/auth/refresh`, { refresh_token: refreshToken });
        if (res.data?.status === 'success' && res.data.data?.access_token) {
          const refreshData = res.data.data;
          syncAuthFromRefreshResponse(refreshData);
          const newToken = refreshData.access_token;

          // Update Authorization header and retry
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          onTokenRefreshed(newToken);
          isRefreshing = false;
          return apiClient(originalRequest);
        }
        throw new Error('Refresh failed');
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        const isAuth401 = (refreshError as any)?.response?.status === 401;
        // During cold-start session restore, do not wipe tokens on transient failures.
        // However, if the server explicitly rejects the refresh token (401), we must wipe them.
        if (typeof window !== 'undefined' && (!isAuthRecoveryActive() || isAuth401)) {
          clearStoredTokens();
          const api = (window as Window & {
            electronAPI?: { clearAuthBackup?: () => Promise<void> };
          }).electronAPI;
          void api?.clearAuthBackup?.();
          const isDesktopShell =
            !!(window as Window & { electronAPI?: { isDesktopShell?: boolean } })
              .electronAPI?.isDesktopShell;
          if (isDesktopShell) {
            window.dispatchEvent(new CustomEvent('yummy-session-expired'));
          } else if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
