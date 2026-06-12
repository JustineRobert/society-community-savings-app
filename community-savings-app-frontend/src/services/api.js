/* global window */
// services/api.js

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// =============================
// ✅ BASE CONFIG
// =============================
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'https://api.titechcapital.com';

// =============================
// ✅ AXIOS INSTANCE
// =============================
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =============================
// ✅ TENANT SUPPORT
// =============================
export const setTenant = (tenantId) => {
  if (tenantId) {
    api.defaults.headers['x-tenant-id'] = tenantId;
  } else {
    delete api.defaults.headers['x-tenant-id'];
  }
};

// =============================
// ✅ TOKEN HELPERS
// =============================
const getToken = () => {
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
};

const setToken = (token) => {
  try {
    window.localStorage.setItem('token', token);
  } catch {}
};

const clearToken = () => {
  try {
    window.localStorage.removeItem('token');
  } catch {}
};

// =============================
// ✅ REQUEST INTERCEPTOR
// =============================
api.interceptors.request.use((config) => {
  const token = getToken();

  if (token && !config.headers.Authorization) {
    config.headers['x-auth-token'] = token;
  }

  // Prevent caching
  config.headers['Cache-Control'] = 'no-cache';
  config.headers['Pragma'] = 'no-cache';

  // =============================
  // ✅ IDEMPOTENCY + LEDGER CONTEXT
  // =============================
  const isFinancial =
    config.url?.includes('/payments') ||
    config.url?.includes('/momo') ||
    config.url?.includes('/transactions') ||
    config.url?.includes('/loans');

  if (isFinancial && config.method !== 'get') {
    config.headers['Idempotency-Key'] =
      config.headers['Idempotency-Key'] || uuidv4();

    // Ledger trace correlation
    config.headers['x-transaction-id'] =
      config.headers['x-transaction-id'] || uuidv4();
  }

  // ✅ AUDIT LOG
  console.info('[API REQUEST]', {
    method: config.method,
    url: config.url,
    tenant: config.headers['x-tenant-id'],
    idempotencyKey: config.headers['Idempotency-Key'],
    transactionId: config.headers['x-transaction-id'],
    timestamp: new Date().toISOString(),
  });

  return config;
});

// =============================
// ✅ TOKEN REFRESH + RETRY
// =============================
let isRefreshing = false;
let subscribers = [];

const subscribe = (cb) => subscribers.push(cb);
const notify = (token) => {
  subscribers.forEach((cb) => cb(token));
  subscribers = [];
};

const MAX_RETRIES = 3;

api.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // ✅ SAFE RETRY
    if (
      (!error.response || [500, 502, 503, 504].includes(status)) &&
      (original._retryCount || 0) < MAX_RETRIES
    ) {
      original._retryCount = (original._retryCount || 0) + 1;
      console.warn(`[RETRY] Attempt ${original._retryCount}`);
      return api(original);
    }

    // ✅ TOKEN REFRESH
    if (status === 401 && !original._retryAuth) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribe((token) => {
            original.headers['x-auth-token'] = token;
            resolve(api(original));
          });
        });
      }

      original._retryAuth = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${API_BASE}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = res.data.token;
        setToken(newToken);

        notify(newToken);
        isRefreshing = false;

        return api(original);
      } catch {
        isRefreshing = false;
        clearToken();
        window.location.href = '/login';
      }
    }

    console.error('[API ERROR]', {
      url: original?.url,
      status,
      message: error.message,
    });

    return Promise.reject(error);
  }
);

// =============================
// ✅ AUTH API
// =============================
export const login = (credentials) =>
  api.post('/api/auth/login', credentials);

// =============================
export default api;