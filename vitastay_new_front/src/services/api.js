import axios from 'axios';
import authStorage from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const TRANSIENT_STATUS = new Set([500, 502, 503, 504]);
const MAX_TRANSIENT_RETRIES = 3;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isGuestPublicPath = () => {
  const path = window.location?.pathname || '';
  return path.startsWith('/listings') || path.startsWith('/search') || path.startsWith('/account') || path.startsWith('/bookings');
};

const isIdempotent = (config) => {
  const method = String(config?.method || 'get').toLowerCase();
  return method === 'get' || method === 'head';
};

const isTransientFailure = (error) => {
  const status = error.response?.status;
  if (TRANSIENT_STATUS.has(status)) return true;
  const code = error.code || error.cause?.code;
  return !error.response && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ERR_NETWORK'].includes(code);
};

const clearAuthStorage = () => {
  authStorage.clearAuth();
  if (isGuestPublicPath()) return;
  window.location.href = '/auth/login';
};

api.interceptors.request.use(
  (config) => {
    const token = authStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    if (isIdempotent(originalRequest) && isTransientFailure(error)) {
      originalRequest._retryCount = originalRequest._retryCount || 0;
      if (originalRequest._retryCount < MAX_TRANSIENT_RETRIES) {
        originalRequest._retryCount += 1;
        await wait(500 * originalRequest._retryCount);
        return api(originalRequest);
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (
        originalRequest.url?.includes('/auth/login')
        || originalRequest.url?.includes('/auth/refresh')
        || originalRequest.url?.includes('/public/listings')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = authStorage.getRefreshToken();
      if (!refreshToken) {
        clearAuthStorage();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;
        authStorage.setAccessToken(newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthStorage();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

export const extractData = (response) => response.data?.data ?? response.data;

export const extractPaginated = (response) => {
  // Accept axios response OR already-unwrapped API body `{ data, pagination }`
  const body = response?.pagination != null || Array.isArray(response?.data)
    ? response
    : response?.data;

  return {
    data: Array.isArray(body?.data) ? body.data : [],
    pagination: body?.pagination ?? { page: 1, limit: 10, total: 0, totalPages: 0 },
  };
};

export const getErrorMessage = (error) => {
  const status = error.response?.status;
  const apiMessage = error.response?.data?.message;
  if (apiMessage) return apiMessage;
  if (status === 503 || error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
    return 'The server is starting up. Please try again in a moment.';
  }
  if (status === 500 && /^Request failed with status code 500$/.test(error.message || '')) {
    return 'The server hit a temporary error. Please retry.';
  }
  return error.message || 'Something went wrong';
};
