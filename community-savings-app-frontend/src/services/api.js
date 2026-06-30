// ============================================================================
// TITech Community Capital
// Enterprise API Client
// File: frontend/src/services/api.js
// Production Grade
// Multi-Tenant | JWT | Retry | Refresh | Observability | Idempotency
// ============================================================================

import axios from "axios";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// Configuration
// ============================================================================

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const REQUEST_TIMEOUT =
  Number(
    import.meta.env
      .VITE_REQUEST_TIMEOUT
  ) || 30000;

const MAX_RETRIES =
  Number(
    import.meta.env
      .VITE_API_RETRIES
  ) || 3;

const RETRY_DELAY =
  Number(
    import.meta.env
      .VITE_API_RETRY_DELAY
  ) || 1000;

const TOKEN_KEY =
  import.meta.env
    .VITE_TOKEN_KEY ||
  "token";

const REFRESH_TOKEN_KEY =
  import.meta.env
    .VITE_REFRESH_TOKEN_KEY ||
  "refreshToken";

const TENANT_KEY =
  import.meta.env
    .VITE_TENANT_KEY ||
  "tenantId";

const DEVICE_KEY =
  "deviceId";

const IS_DEV =
  import.meta.env.DEV;

// ============================================================================
// Storage
// ============================================================================

const storage = {
  get(key) {
    try {
      return (
        localStorage.getItem(
          key
        ) ||
        sessionStorage.getItem(
          key
        )
      );
    } catch {
      return null;
    }
  },

  set(key, value) {
    try {
      if (
        value === undefined ||
        value === null
      ) {
        this.remove(key);
        return;
      }

      localStorage.setItem(
        key,
        value
      );
    } catch {}
  },

  remove(key) {
    try {
      localStorage.removeItem(
        key
      );
      sessionStorage.removeItem(
        key
      );
    } catch {}
  },
};

// ============================================================================
// Token Helpers
// ============================================================================

export const getToken =
  () =>
    storage.get(
      TOKEN_KEY
    );

export const setToken =
  token =>
    storage.set(
      TOKEN_KEY,
      token
    );

export const clearToken =
  () =>
    storage.remove(
      TOKEN_KEY
    );

export const getRefreshToken =
  () =>
    storage.get(
      REFRESH_TOKEN_KEY
    );

export const setRefreshToken =
  token =>
    storage.set(
      REFRESH_TOKEN_KEY,
      token
    );

export const clearRefreshToken =
  () =>
    storage.remove(
      REFRESH_TOKEN_KEY
    );

// ============================================================================
// Tenant Helpers
// ============================================================================

export const getTenant =
  () =>
    storage.get(
      TENANT_KEY
    );

export const setTenant =
  tenantId => {
    storage.set(
      TENANT_KEY,
      tenantId
    );

    api.defaults.headers.common[
      "x-tenant-id"
    ] = tenantId;
  };

export const clearTenant =
  () => {
    storage.remove(
      TENANT_KEY
    );

    delete api.defaults
      .headers.common[
      "x-tenant-id"
    ];
  };

// ============================================================================
// Device Helpers
// ============================================================================

export function getDeviceId() {
  let deviceId =
    storage.get(
      DEVICE_KEY
    );

  if (!deviceId) {
    deviceId =
      crypto.randomUUID();

    storage.set(
      DEVICE_KEY,
      deviceId
    );
  }

  return deviceId;
}

// ============================================================================
// Axios Instance
// ============================================================================

const api = axios.create({
  baseURL: API_BASE,
  timeout:
    REQUEST_TIMEOUT,
  withCredentials: true,
  headers: {
    Accept:
      "application/json",
    "Content-Type":
      "application/json",
  },
});

// ============================================================================
// Request Registry
// ============================================================================

const pendingRequests =
  new Map();

function requestKey(
  config
) {
  return [
    config.method,
    config.url,
    JSON.stringify(
      config.params
    ),
    JSON.stringify(
      config.data
    ),
  ].join(":");
}

// ============================================================================
// Retry Helpers
// ============================================================================

function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function retryDelay(
  attempt
) {
  const jitter =
    Math.random() * 500;

  return (
    RETRY_DELAY *
      Math.pow(
        2,
        attempt - 1
      ) +
    jitter
  );
}

function shouldRetry(
  status
) {
  return (
    !status ||
    [
      408,
      425,
      429,
      500,
      502,
      503,
      504,
    ].includes(
      status
    )
  );
}

// ============================================================================
// Refresh Token Management
// ============================================================================

let isRefreshing =
  false;

let subscribers =
  [];

function subscribe(
  callback
) {
  subscribers.push(
    callback
  );
}

function notify(
  token
) {
  subscribers.forEach(
    cb =>
      cb(token)
  );

  subscribers = [];
}

// ============================================================================
// Request Interceptor
// ============================================================================

api.interceptors.request.use(
  config => {
    config.metadata = {
      startedAt:
        Date.now(),
    };

    const token =
      getToken();

    const tenantId =
      getTenant();

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    if (tenantId) {
      config.headers[
        "x-tenant-id"
      ] = tenantId;
    }

    config.headers[
      "x-request-id"
    ] =
      config.headers[
        "x-request-id"
      ] ||
      uuidv4();

    config.headers[
      "x-correlation-id"
    ] =
      config.headers[
        "x-correlation-id"
      ] ||
      uuidv4();

    config.headers[
      "x-device-id"
    ] =
      getDeviceId();

    config.headers[
      "x-client-version"
    ] =
      import.meta.env
        .VITE_APP_VERSION ||
      "1.0.0";

    config.headers[
      "x-client-platform"
    ] = "web";

    // Financial APIs
    const financial =
      [
        "/transactions",
        "/payments",
        "/wallet",
        "/ledger",
        "/loans",
        "/savings",
        "/momo",
      ].some(path =>
        config.url?.includes(
          path
        )
      );

    if (
      financial &&
      config.method !==
        "get"
    ) {
      config.headers[
        "Idempotency-Key"
      ] =
        config.headers[
          "Idempotency-Key"
        ] ||
        uuidv4();

      config.headers[
        "x-transaction-id"
      ] =
        config.headers[
          "x-transaction-id"
        ] ||
        uuidv4();
    }

    // Duplicate request prevention
    const key =
      requestKey(
        config
      );

    if (
      pendingRequests.has(
        key
      )
    ) {
      const controller =
        new AbortController();

      config.signal =
        controller.signal;

      controller.abort();
    }

    pendingRequests.set(
      key,
      true
    );

    if (IS_DEV) {
      console.info(
        "[API REQUEST]",
        {
          method:
            config.method,
          url:
            config.url,
          correlationId:
            config.headers[
              "x-correlation-id"
            ],
        }
      );
    }

    return config;
  },
  error =>
    Promise.reject(
      error
    )
);

// ============================================================================
// Response Interceptor
// ============================================================================

api.interceptors.response.use(
  response => {
    const key =
      requestKey(
        response.config
      );

    pendingRequests.delete(
      key
    );

    if (
      response.config
        .metadata
    ) {
      const duration =
        Date.now() -
        response.config
          .metadata
          .startedAt;

      if (IS_DEV) {
        console.info(
          "[API RESPONSE]",
          {
            url:
              response.config
                .url,
            duration:
              `${duration}ms`,
            status:
              response.status,
          }
        );
      }
    }

    return response;
  },

  async error => {
    const request =
      error.config || {};

    const key =
      requestKey(
        request
      );

    pendingRequests.delete(
      key
    );

    const status =
      error.response
        ?.status;

    // ==========================================================
    // Offline
    // ==========================================================

    if (
      !navigator.onLine
    ) {
      return Promise.reject(
        {
          ...error,
          message:
            "You are offline.",
        }
      );
    }

    // ==========================================================
    // Retry
    // ==========================================================

    if (
      shouldRetry(
        status
      ) &&
      (request._retryCount ||
        0) <
        MAX_RETRIES
    ) {
      request._retryCount =
        (request._retryCount ||
          0) + 1;

      await sleep(
        retryDelay(
          request._retryCount
        )
      );

      return api(
        request
      );
    }

    // ==========================================================
    // Token Refresh
    // ==========================================================

    if (
      status === 401 &&
      !request._retry &&
      !request.url?.includes(
        "/auth/refresh"
      )
    ) {
      if (
        isRefreshing
      ) {
        return new Promise(
          resolve => {
            subscribe(
              token => {
                request.headers.Authorization =
                  `Bearer ${token}`;

                resolve(
                  api(
                    request
                  )
                );
              }
            );
          }
        );
      }

      request._retry =
        true;

      isRefreshing =
        true;

      try {
        const response =
          await axios.post(
            `${API_BASE}/api/auth/refresh`,
            {
              refreshToken:
                getRefreshToken(),
            },
            {
              withCredentials:
                true,
            }
          );

        const token =
          response.data
            ?.accessToken ||
          response.data
            ?.token;

        const refresh =
          response.data
            ?.refreshToken;

        if (!token) {
          throw new Error(
            "Invalid refresh response."
          );
        }

        setToken(token);

        if (refresh) {
          setRefreshToken(
            refresh
          );
        }

        api.defaults.headers.common.Authorization =
          `Bearer ${token}`;

        notify(token);

        isRefreshing =
          false;

        request.headers.Authorization =
          `Bearer ${token}`;

        return api(
          request
        );
      } catch (
        refreshError
      ) {
        isRefreshing =
          false;

        clearToken();
        clearRefreshToken();
        clearTenant();

        delete api.defaults
          .headers.common
          .Authorization;

        if (
          window.location.pathname !==
          "/login"
        ) {
          window.location.assign(
            "/login"
          );
        }

        return Promise.reject(
          refreshError
        );
      }
    }

    if (IS_DEV) {
      console.error(
        "[API ERROR]",
        {
          url:
            request.url,
          method:
            request.method,
          status,
          message:
            error.message,
          data:
            error.response
              ?.data,
        }
      );
    }

    return Promise.reject(
      error
    );
  }
);

// ============================================================================
// Upload Helpers
// ============================================================================

export function uploadFile(
  url,
  file,
  extra = {},
  config = {}
) {
  const form =
    new FormData();

  form.append(
    "file",
    file
  );

  Object.entries(
    extra
  ).forEach(
    ([k, v]) =>
      form.append(k, v)
  );

  return api.post(
    url,
    form,
    {
      ...config,
      headers: {
        ...config.headers,
        "Content-Type":
          "multipart/form-data",
      },
    }
  );
}

// ============================================================================
// Download Helpers
// ============================================================================

export function downloadFile(
  url,
  config = {}
) {
  return api.get(url, {
    ...config,
    responseType:
      "blob",
  });
}

// ============================================================================
// Authentication APIs
// ============================================================================

export const login =
  payload =>
    api.post(
      "/api/auth/login",
      payload
    );

export const register =
  payload =>
    api.post(
      "/api/auth/register",
      payload
    );

export const logout =
  () =>
    api.post(
      "/api/auth/logout"
    );

export const refreshToken =
  () =>
    api.post(
      "/api/auth/refresh"
    );

// ============================================================================
// Generic HTTP Methods
// ============================================================================

export const get = (
  url,
  config
) =>
  api.get(
    url,
    config
  );

export const post = (
  url,
  data,
  config
) =>
  api.post(
    url,
    data,
    config
  );

export const put = (
  url,
  data,
  config
) =>
  api.put(
    url,
    data,
    config
  );

export const patch = (
  url,
  data,
  config
) =>
  api.patch(
    url,
    data,
    config
  );

export const del = (
  url,
  config
) =>
  api.delete(
    url,
    config
  );

// ============================================================================
// Diagnostics
// ============================================================================

export function getApiDiagnostics() {
  return {
    apiBase:
      API_BASE,
    tenantId:
      getTenant(),
    authenticated:
      !!getToken(),
    deviceId:
      getDeviceId(),
    pendingRequests:
      pendingRequests.size,
  };
}

// ============================================================================
// Export
// ============================================================================

export default api;