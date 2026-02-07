import axios from 'axios';

// TODO: Move to .env
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://yummy-container-app.ambitiouspebble-f5ba67fe.southeastasia.azurecontainerapps.io';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Token
apiClient.interceptors.request.use(
  (config) => {
    // TODO: Get token from Zustand store or localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
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
      if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
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
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        if (!refreshToken) throw new Error('No refresh token');

        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
        if (res.data?.status === 'success' && res.data.data?.access_token) {
          const newToken = res.data.data.access_token;
          const newRefresh = res.data.data.refresh_token;
          localStorage.setItem('accessToken', newToken);
          if (newRefresh) localStorage.setItem('refreshToken', newRefresh);

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
        // Refresh failed — clear auth and redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
