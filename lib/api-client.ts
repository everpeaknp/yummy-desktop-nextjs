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

// Response Interceptor: Handle 401 & Errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized (Token refresh logic to be added)
    if (error.response?.status === 401 && !originalRequest._retry) {
      // For now, redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
