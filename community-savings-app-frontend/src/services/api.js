/* eslint-disable no-console */
// ============================================================================
// TITech Community Capital
// Enterprise API Client
// Production Grade
// ============================================================================

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// CONFIG
// ============================================================================

const API_BASE =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

const TOKEN_KEY = 'token';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const IS_DEV = import.meta.env.DEV;

// ============================================================================
// AXIOS INSTANCE
// ============================================================================

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ============================================================================
// TOKEN HELPERS
// ============================================================================

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Token storage error', err);
  }
};

export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

// ============================================================================
// TENANT SUPPORT
// ============================================================================

export const setTenant = (tenantId) => {
  if (tenantId) {
    api.defaults.headers.common['x-tenant-id'] = tenantId;
  } else {
    delete api.defaults.headers.common['x-tenant-id'];
  }
};

export const clearTenant = () => {
  delete api.defaults.headers.common['x-tenant-id'];
};

// ============================================================================
// REQUEST INTERCEPTOR
// ============================================================================

api.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      config.headers.Authorization =
        config.headers.Authorization ||
        `Bearer ${token}`;

      config.headers['x-auth-token'] =
        config.headers['x-auth-token'] || token;
    }

    config.headers['Cache-Control'] = 'no-cache';
    config.headers.Pragma = 'no-cache';

    const correlationId = uuidv4();

    config.headers['x-correlation-id'] =
      config.headers['x-correlation-id'] ||
      correlationId;

    const isFinancialOperation =
      config.url?.includes('/payments') ||
      config.url?.includes('/momo') ||
      config.url?.includes('/transactions') ||
      config.url?.includes('/loans') ||
      config.url?.includes('/withdrawals') ||
      config.url?.includes('/deposits') ||
      config.url?.includes('/ledger');

    if (
      isFinancialOperation &&
      config.method?.toLowerCase() !== 'get'
    ) {
      config.headers['Idempotency-Key'] =
        config.headers['Idempotency-Key'] ||
        uuidv4();

      config.headers['x-transaction-id'] =
        config.headers['x-transaction-id'] ||
        uuidv4();
    }

    if (IS_DEV) {
      console.info('[API REQUEST]', {
        method: config.method,
        url: config.url,
        correlationId,
        timestamp: new Date().toISOString(),
      });
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================================
// TOKEN REFRESH MANAGEMENT
// ============================================================================

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const notifySubscribers = (token) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

// ============================================================================
// RETRY HELPERS
// ============================================================================

const sleep = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

const shouldRetry = (status) =>
  !status ||
  [500, 502, 503, 504].includes(status);

// ============================================================================
// RESPONSE INTERCEPTOR
// ============================================================================

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // =========================================================================
    // NETWORK + SERVER RETRIES
    // =========================================================================

    if (
      shouldRetry(status) &&
      (originalRequest._retryCount || 0) <
        MAX_RETRIES
    ) {
      originalRequest._retryCount =
        (originalRequest._retryCount || 0) + 1;

      const delay =
        RETRY_DELAY_MS *
        originalRequest._retryCount;

      if (IS_DEV) {
        console.warn(
          `[API RETRY] Attempt ${originalRequest._retryCount}`
        );
      }

      await sleep(delay);

      return api(originalRequest);
    }

    // =========================================================================
    // TOKEN REFRESH
    // =========================================================================

    if (
      status === 401 &&
      !originalRequest._retryAuth &&
      !originalRequest.url?.includes('/api/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization =
              `Bearer ${token}`;

            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retryAuth = true;
      isRefreshing = true;

      try {
        const refreshResponse =
          await axios.post(
            `${API_BASE}/api/auth/refresh`,
            {},
            {
              withCredentials: true,
            }
          );

        const newToken =
          refreshResponse.data.token ||
          refreshResponse.data.accessToken;

        if (!newToken) {
          throw new Error(
            'Refresh endpoint returned no token'
          );
        }

        setToken(newToken);

        api.defaults.headers.common.Authorization =
          `Bearer ${newToken}`;

        notifySubscribers(newToken);

        isRefreshing = false;

        originalRequest.headers.Authorization =
          `Bearer ${newToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;

        clearToken();

        delete api.defaults.headers.common
          .Authorization;

        if (
          window.location.pathname !== '/login'
        ) {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    // =========================================================================
    // LOGGING
    // =========================================================================

    if (IS_DEV) {
      console.error('[API ERROR]', {
        url: originalRequest?.url,
        method: originalRequest?.method,
        status,
        message: error.message,
        response: error.response?.data,
      });
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// AUTH HELPERS
// ============================================================================

export const login = (credentials) =>
  api.post('/api/auth/login', credentials);

export const register = (payload) =>
  api.post('/api/auth/register', payload);

export const logout = () =>
  api.post('/api/auth/logout');

export const refreshToken = () =>
  api.post('/api/auth/refresh');

// ============================================================================
// EXPORTS
// ============================================================================

export default api;