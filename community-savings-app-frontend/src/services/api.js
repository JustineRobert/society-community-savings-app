// ============================================================================
// TITech Community Capital LTD
// Enterprise API Client
// File: frontend/src/services/api.js
//
// Production Grade
// Multi-Tenant | JWT | Refresh | Retry | Observability
// Idempotency | Offline Awareness | Financial Safety
//
// Security model:
// - Access token is held in memory only.
// - Refresh token is stored by the backend in an HttpOnly cookie.
// - JavaScript must NOT persist or read refresh tokens.
// - Tenant headers are context hints only.
// - Backend authorization remains authoritative.
// - Financial mutations preserve idempotency across retries.
// - Authentication refresh is single-flight.
// - Offline state is explicitly classified.
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
  Number(import.meta.env.VITE_REQUEST_TIMEOUT) || 30000;

const HEALTH_TIMEOUT =
  Number(import.meta.env.VITE_API_HEALTH_TIMEOUT) || 5000;

const MAX_RETRIES = Math.max(
  0,
  Number(import.meta.env.VITE_API_RETRIES) || 3
);

const RETRY_DELAY = Math.max(
  100,
  Number(import.meta.env.VITE_API_RETRY_DELAY) || 1000
);

const TENANT_KEY =
  import.meta.env.VITE_TENANT_KEY || "tenantId";

const DEVICE_KEY =
  import.meta.env.VITE_DEVICE_KEY || "deviceId";

const APP_VERSION =
  import.meta.env.VITE_APP_VERSION || "1.0.0";

const IS_DEV =
  Boolean(import.meta.env.DEV);

const REFRESH_ENDPOINT =
  "/api/auth/refresh";

const LOGIN_ENDPOINT =
  "/api/auth/login";

const REGISTER_ENDPOINT =
  "/api/auth/register";

const LOGOUT_ENDPOINT =
  "/api/auth/logout";

// ============================================================================
// Security Constants
// ============================================================================

const SAFE_METHODS = new Set([
  "get",
  "head",
  "options",
]);

const MUTATION_METHODS = new Set([
  "post",
  "put",
  "patch",
  "delete",
]);

const FINANCIAL_PATHS = Object.freeze([
  "/transactions",
  "/payments",
  "/wallet",
  "/ledger",
  "/loans",
  "/savings",
  "/momo",
  "/contributions",
  "/withdrawals",
]);

const RETRYABLE_STATUS_CODES = new Set([
  408,
  425,
  429,
  500,
  502,
  503,
  504,
]);

const AUTH_EXCLUDED_ENDPOINTS = new Set([
  REFRESH_ENDPOINT,
  LOGIN_ENDPOINT,
  REGISTER_ENDPOINT,
  LOGOUT_ENDPOINT,
]);

// ============================================================================
// Access Token State
// ============================================================================
//
// IMPORTANT:
//
// The access token intentionally exists only in memory.
//
// It is NOT stored in:
// - localStorage
// - sessionStorage
// - IndexedDB
// - cookies
//
// After a browser reload, bootstrapAuthentication() can obtain a fresh access
// token through the backend's HttpOnly refresh cookie.
// ============================================================================

let accessToken = null;

// ============================================================================
// Tenant / Device Storage
// ============================================================================
//
// Tenant and device identifiers are contextual values.
//
// They MUST NOT be treated as authentication credentials.
//
// The backend must independently validate:
// - authenticated user
// - tenant membership
// - tenant permissions
// - role
// - resource ownership
// ============================================================================

const storage = {
  get(key) {
    if (
      typeof window === "undefined"
    ) {
      return null;
    }

    try {
      return (
        window.localStorage.getItem(key) ||
        window.sessionStorage.getItem(key)
      );
    } catch {
      return null;
    }
  },

  set(key, value) {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    try {
      if (
        value === undefined ||
        value === null
      ) {
        this.remove(key);
        return;
      }

      window.localStorage.setItem(
        key,
        String(value)
      );
    } catch {
      // Storage may be unavailable because of browser privacy settings.
    }
  },

  remove(key) {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore storage failures.
    }
  },
};

// ============================================================================
// Token Helpers
// ============================================================================

export function getToken() {
  return accessToken;
}

export function setToken(token) {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    accessToken = null;
    return;
  }

  accessToken = token;
}

export function clearToken() {
  accessToken = null;
}

// ============================================================================
// Refresh Token Helpers
// ============================================================================
//
// These intentionally do NOTHING.
//
// The refresh token belongs to the backend/browser cookie security boundary.
//
// Recommended cookie:
//
// Set-Cookie:
// refreshToken=<opaque-token>;
// HttpOnly;
// Secure;
// SameSite=Lax;
// Path=/api/auth;
//
// JavaScript must never read this token.
// ============================================================================

export function getRefreshToken() {
  return null;
}

export function setRefreshToken() {
  // Intentionally ignored.
}

export function clearRefreshToken() {
  // Backend logout must clear the HttpOnly cookie.
}

// ============================================================================
// Tenant Helpers
// ============================================================================

export function getTenant() {
  return storage.get(TENANT_KEY);
}

export function setTenant(tenantId) {
  if (
    tenantId === undefined ||
    tenantId === null ||
    tenantId === ""
  ) {
    clearTenant();
    return;
  }

  storage.set(
    TENANT_KEY,
    tenantId
  );

  api.defaults.headers.common[
    "x-tenant-id"
  ] = String(tenantId);
}

export function clearTenant() {
  storage.remove(TENANT_KEY);

  delete api.defaults.headers.common[
    "x-tenant-id"
  ];
}

// ============================================================================
// Device Identity
// ============================================================================

function generateDeviceId() {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through.
  }

  return uuidv4();
}

export function getDeviceId() {
  let deviceId =
    storage.get(DEVICE_KEY);

  if (!deviceId) {
    deviceId =
      generateDeviceId();

    storage.set(
      DEVICE_KEY,
      deviceId
    );
  }

  return deviceId;
}

// ============================================================================
// Axios Instances
// ============================================================================
//
// api:
//   Authenticated application API.
//
// authApi:
//   Authentication API.
//
// authApi deliberately does NOT receive the authenticated API interceptor.
// This prevents refresh loops.
// ============================================================================

const api = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

const authApi = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// ============================================================================
// Request Tracking
// ============================================================================

const pendingRequests =
  new Map();

const requestControllers =
  new Map();

// ============================================================================
// Refresh State
// ============================================================================
//
// Single-flight refresh:
//
// Request A -> 401 -> refresh
// Request B -> 401 -> waits
// Request C -> 401 -> waits
//
// Only ONE refresh request reaches the backend.
// ============================================================================

let refreshPromise = null;

// ============================================================================
// Request Utilities
// ============================================================================

function normalizeMethod(method) {
  return (
    method ||
    "get"
  ).toLowerCase();
}

function isSafeMethod(method) {
  return SAFE_METHODS.has(
    normalizeMethod(method)
  );
}

function isMutationMethod(method) {
  return MUTATION_METHODS.has(
    normalizeMethod(method)
  );
}

// ============================================================================
// URL Normalization
// ============================================================================

function normalizeUrl(url = "") {
  return String(url)
    .split("?")[0]
    .replace(/\/+$/, "")
    .toLowerCase();
}

// ============================================================================
// Financial Request Detection
// ============================================================================
//
// Only path segments are considered.
//
// This reduces accidental matches such as:
// /reports?source=/payments
// ============================================================================

function isFinancialRequest(config) {
  const url =
    normalizeUrl(config?.url);

  return FINANCIAL_PATHS.some(
    path => {
      const normalizedPath =
        path.toLowerCase();

      return (
        url === normalizedPath ||
        url.startsWith(
          `${normalizedPath}/`
        )
      );
    }
  );
}

function hasIdempotencyKey(config) {
  const headers =
    config?.headers || {};

  return Boolean(
    headers["Idempotency-Key"] ||
    headers["idempotency-key"]
  );
}

// ============================================================================
// Stable Serialization
// ============================================================================

function stableSerialize(value) {
  if (
    value === undefined
  ) {
    return "";
  }

  if (
    value === null ||
    typeof value !== "object"
  ) {
    return JSON.stringify(
      value
    );
  }

  if (
    value instanceof FormData
  ) {
    return "[FormData]";
  }

  if (
    value instanceof Blob
  ) {
    return `[Blob:${value.type || "unknown"}]`;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(
      value.map(
        stableSerialize
      )
    );
  }

  const sortedKeys =
    Object.keys(value)
      .sort();

  return JSON.stringify(
    sortedKeys.reduce(
      (result, key) => {
        result[key] =
          stableSerialize(
            value[key]
          );

        return result;
      },
      {}
    )
  );
}

// ============================================================================
// Request Key
// ============================================================================

function requestKey(config) {
  return [
    normalizeMethod(
      config?.method
    ),
    config?.baseURL || "",
    config?.url || "",
    stableSerialize(
      config?.params
    ),
    stableSerialize(
      config?.data
    ),
    getTenant() || "",
  ].join("|");
}

// ============================================================================
// Header Utilities
// ============================================================================

function ensureHeader(
  config,
  name,
  value
) {
  if (!config.headers) {
    config.headers = {};
  }

  if (
    config.headers[name] === undefined ||
    config.headers[name] === null ||
    config.headers[name] === ""
  ) {
    config.headers[name] =
      value;
  }
}

// ============================================================================
// Financial Idempotency
// ============================================================================
//
// IMPORTANT:
//
// Financial mutation identifiers MUST survive retries.
//
// Initial request:
//   Idempotency-Key = ABC
//
// Retry:
//   Idempotency-Key = ABC
//
// Retry after timeout:
//   Idempotency-Key = ABC
//
// This allows the backend to recognize duplicate delivery attempts.
// ============================================================================

function ensureFinancialHeaders(
  config
) {
  const method =
    normalizeMethod(
      config?.method
    );

  if (
    !isFinancialRequest(config) ||
    !isMutationMethod(method)
  ) {
    return;
  }

  ensureHeader(
    config,
    "Idempotency-Key",
    uuidv4()
  );

  ensureHeader(
    config,
    "x-transaction-id",
    uuidv4()
  );
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

function getRetryAfterDelay(
  error
) {
  const retryAfter =
    error?.response?.headers?.[
      "retry-after"
    ];

  if (!retryAfter) {
    return null;
  }

  const seconds =
    Number(retryAfter);

  if (
    Number.isFinite(seconds) &&
    seconds >= 0
  ) {
    return Math.min(
      seconds * 1000,
      30000
    );
  }

  const retryDate =
    Date.parse(
      retryAfter
    );

  if (
    !Number.isNaN(
      retryDate
    )
  ) {
    return Math.max(
      0,
      Math.min(
        retryDate -
          Date.now(),
        30000
      )
    );
  }

  return null;
}

function calculateRetryDelay(
  attempt,
  error
) {
  const serverDelay =
    getRetryAfterDelay(
      error
    );

  if (
    serverDelay !== null
  ) {
    return serverDelay;
  }

  const exponential =
    RETRY_DELAY *
    Math.pow(
      2,
      Math.max(
        0,
        attempt - 1
      )
    );

  const jitter =
    Math.random() * 500;

  return Math.min(
    exponential + jitter,
    30000
  );
}

// ============================================================================
// Retry Classification
// ============================================================================

function isNetworkError(
  error
) {
  return (
    !error?.response &&
    Boolean(error)
  );
}

function isRetryableStatus(
  status
) {
  return RETRYABLE_STATUS_CODES.has(
    status
  );
}

// ============================================================================
// Retry Policy
// ============================================================================
//
// SAFE:
//
// GET / HEAD / OPTIONS
// may retry automatically.
//
// MUTATIONS:
//
// POST / PUT / PATCH / DELETE
// only retry when an idempotency key exists.
//
// This is critical for:
//
// - savings
// - contributions
// - withdrawals
// - payments
// - Mobile Money
// - wallets
// - loans
// - ledger operations
// ============================================================================

function shouldRetryRequest(
  config,
  error
) {
  if (!config) {
    return false;
  }

  const method =
    normalizeMethod(
      config.method
    );

  const status =
    error?.response?.status;

  const retryableNetwork =
    isNetworkError(error);

  const retryableStatus =
    isRetryableStatus(
      status
    );

  if (
    !retryableNetwork &&
    !retryableStatus
  ) {
    return false;
  }

  if (
    isSafeMethod(method)
  ) {
    return true;
  }

  if (
    isMutationMethod(method)
  ) {
    return hasIdempotencyKey(
      config
    );
  }

  return false;
}

// ============================================================================
// Retry Counter
// ============================================================================

function getRetryCount(
  config
) {
  return Number(
    config?._retryCount || 0
  );
}

function incrementRetryCount(
  config
) {
  config._retryCount =
    getRetryCount(config) + 1;
}

// ============================================================================
// Pending Request Tracking
// ============================================================================
//
// Financial mutations are NEVER automatically cancelled.
//
// Safe duplicate GET requests may supersede older identical requests.
// ============================================================================

function registerPendingRequest(
  config
) {
  const key =
    requestKey(config);

  const method =
    normalizeMethod(
      config.method
    );

  if (
    isSafeMethod(method) &&
    requestControllers.has(key)
  ) {
    const previousController =
      requestControllers.get(
        key
      );

    try {
      previousController.abort();
    } catch {
      // Ignore abort errors.
    }
  }

  const controller =
    new AbortController();

  if (!config.signal) {
    config.signal =
      controller.signal;
  }

  requestControllers.set(
    key,
    controller
  );

  pendingRequests.set(
    key,
    {
      method,
      url: config.url,
      startedAt: Date.now(),
      financial:
        isFinancialRequest(
          config
        ),
      idempotencyKey:
        config.headers?.[
          "Idempotency-Key"
        ] || null,
    }
  );

  return key;
}

function cleanupPendingRequest(
  config
) {
  if (!config) {
    return;
  }

  const key =
    requestKey(config);

  pendingRequests.delete(
    key
  );

  requestControllers.delete(
    key
  );
}

// ============================================================================
// Offline State
// ============================================================================

function isBrowserOffline() {
  return (
    typeof navigator !==
      "undefined" &&
    navigator.onLine === false
  );
}

function createOfflineError(
  originalError
) {
  const error =
    new Error(
      "The device is offline. The request could not be completed."
    );

  error.code =
    "CLIENT_OFFLINE";

  error.isOffline = true;

  error.originalError =
    originalError;

  return error;
}

// ============================================================================
// Cancellation
// ============================================================================

function isAbortError(
  error
) {
  return (
    error?.code ===
      "ERR_CANCELED" ||
    error?.name ===
      "CanceledError" ||
    error?.message ===
      "canceled"
  );
}

// ============================================================================
// Authentication Endpoint Detection
// ============================================================================

function isAuthenticationEndpoint(
  url
) {
  if (!url) {
    return false;
  }

  return Array.from(
    AUTH_EXCLUDED_ENDPOINTS
  ).some(
    endpoint =>
      url.includes(endpoint)
  );
}

// ============================================================================
// Refresh Token Flow
// ============================================================================

async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise =
    authApi
      .post(
        REFRESH_ENDPOINT
      )
      .then(response => {
        const token =
          response.data
            ?.accessToken ||
          response.data
            ?.token;

        if (
          !token
        ) {
          throw new Error(
            "Invalid TITech refresh response: access token missing."
          );
        }

        setToken(token);

        const tenantId =
          response.data
            ?.tenantId;

        if (
          tenantId
        ) {
          setTenant(
            tenantId
          );
        }

        api.defaults.headers.common.Authorization =
          `Bearer ${token}`;

        return token;
      })
      .finally(() => {
        refreshPromise =
          null;
      });

  return refreshPromise;
}

// ============================================================================
// Authentication Cleanup
// ============================================================================

function clearAuthenticationState() {
  clearToken();

  // HttpOnly refresh cookie must be cleared by backend logout.
  clearRefreshToken();

  clearTenant();

  delete api.defaults.headers.common
    .Authorization;
}

// ============================================================================
// Redirect To Login
// ============================================================================

function redirectToLogin() {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  if (
    window.location.pathname ===
    "/login"
  ) {
    return;
  }

  window.location.assign(
    "/login"
  );
}

// ============================================================================
// Request Interceptor
// ============================================================================

api.interceptors.request.use(
  config => {
    config.metadata = {
      startedAt: Date.now(),
    };

    if (!config.headers) {
      config.headers = {};
    }

    // ------------------------------------------------------------
    // Access Token
    // ------------------------------------------------------------

    const token =
      getToken();

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    // ------------------------------------------------------------
    // Tenant Context
    // ------------------------------------------------------------

    const tenantId =
      getTenant();

    if (tenantId) {
      config.headers[
        "x-tenant-id"
      ] = tenantId;
    }

    // ------------------------------------------------------------
    // Request Identity
    // ------------------------------------------------------------

    ensureHeader(
      config,
      "x-request-id",
      uuidv4()
    );

    ensureHeader(
      config,
      "x-correlation-id",
      uuidv4()
    );

    ensureHeader(
      config,
      "x-device-id",
      getDeviceId()
    );

    ensureHeader(
      config,
      "x-client-version",
      APP_VERSION
    );

    ensureHeader(
      config,
      "x-client-platform",
      "web"
    );

    // ------------------------------------------------------------
    // Financial Safety
    // ------------------------------------------------------------

    ensureFinancialHeaders(
      config
    );

    // ------------------------------------------------------------
    // Pending Request Tracking
    // ------------------------------------------------------------

    registerPendingRequest(
      config
    );

    // ------------------------------------------------------------
    // Development Logging
    // ------------------------------------------------------------

    if (IS_DEV) {
      console.info(
        "[TITech API REQUEST]",
        {
          method:
            normalizeMethod(
              config.method
            ).toUpperCase(),

          url:
            config.url,

          correlationId:
            config.headers[
              "x-correlation-id"
            ],

          requestId:
            config.headers[
              "x-request-id"
            ],

          tenantId:
            config.headers[
              "x-tenant-id"
            ] || null,

          financial:
            isFinancialRequest(
              config
            ),

          idempotencyKey:
            config.headers[
              "Idempotency-Key"
            ] || null,
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
    cleanupPendingRequest(
      response.config
    );

    if (
      response.config?.metadata
    ) {
      const duration =
        Date.now() -
        response.config.metadata
          .startedAt;

      if (IS_DEV) {
        console.info(
          "[TITech API RESPONSE]",
          {
            method:
              normalizeMethod(
                response.config
                  .method
              ).toUpperCase(),

            url:
              response.config
                .url,

            duration:
              `${duration}ms`,

            status:
              response.status,

            correlationId:
              response.config
                .headers?.[
                "x-correlation-id"
              ],
          }
        );
      }
    }

    return response;
  },

  async error => {
    const request =
      error?.config || {};

    cleanupPendingRequest(
      request
    );

    const status =
      error?.response?.status;

    // ==========================================================
    // Cancellation
    // ==========================================================

    if (
      isAbortError(error)
    ) {
      return Promise.reject(
        error
      );
    }

    // ==========================================================
    // Offline
    // ==========================================================

    if (
      isBrowserOffline()
    ) {
      return Promise.reject(
        createOfflineError(
          error
        )
      );
    }

    // ==========================================================
    // Authentication Refresh
    // ==========================================================

    if (
      status === 401 &&
      !request._authRetry &&
      !isAuthenticationEndpoint(
        request.url
      )
    ) {
      request._authRetry =
        true;

      try {
        const token =
          await refreshAccessToken();

        request.headers =
          request.headers || {};

        request.headers.Authorization =
          `Bearer ${token}`;

        return api(
          request
        );
      } catch (
        refreshError
      ) {
        clearAuthenticationState();

        redirectToLogin();

        return Promise.reject(
          refreshError
        );
      }
    }

    // ==========================================================
    // Generic Retry
    // ==========================================================

    if (
      shouldRetryRequest(
        request,
        error
      ) &&
      getRetryCount(request) <
        MAX_RETRIES
    ) {
      incrementRetryCount(
        request
      );

      const attempt =
        getRetryCount(
          request
        );

      const delay =
        calculateRetryDelay(
          attempt,
          error
        );

      if (IS_DEV) {
        console.warn(
          "[TITech API RETRY]",
          {
            attempt,
            maxRetries:
              MAX_RETRIES,

            method:
              normalizeMethod(
                request.method
              ).toUpperCase(),

            url:
              request.url,

            status,

            delay,

            financial:
              isFinancialRequest(
                request
              ),

            idempotencyKey:
              request.headers?.[
                "Idempotency-Key"
              ] || null,
          }
        );
      }

      await sleep(
        delay
      );

      if (
        isBrowserOffline()
      ) {
        return Promise.reject(
          createOfflineError(
            error
          )
        );
      }

      return api(
        request
      );
    }

    // ==========================================================
    // Development Error Logging
    // ==========================================================

    if (IS_DEV) {
      console.error(
        "[TITech API ERROR]",
        {
          url:
            request.url,

          method:
            normalizeMethod(
              request.method
            ).toUpperCase(),

          status,

          code:
            error.code,

          message:
            error.message,

          correlationId:
            request.headers?.[
              "x-correlation-id"
            ],

          requestId:
            request.headers?.[
              "x-request-id"
            ],

          financial:
            isFinancialRequest(
              request
            ),
        }
      );
    }

    return Promise.reject(
      error
    );
  }
);

// ============================================================================
// Authentication APIs
// ============================================================================

export async function login(
  payload
) {
  const response =
    await authApi.post(
      LOGIN_ENDPOINT,
      payload
    );

  const token =
    response.data
      ?.accessToken ||
    response.data
      ?.token;

  if (token) {
    setToken(token);

    api.defaults.headers.common.Authorization =
      `Bearer ${token}`;
  }

  const tenantId =
    response.data
      ?.tenantId ||
    response.data
      ?.user?.tenantId;

  if (tenantId) {
    setTenant(
      tenantId
    );
  }

  // Refresh token must be delivered by backend
  // through an HttpOnly Secure cookie.

  return response;
}

export async function register(
  payload
) {
  const response =
    await authApi.post(
      REGISTER_ENDPOINT,
      payload
    );

  const token =
    response.data
      ?.accessToken ||
    response.data
      ?.token;

  if (token) {
    setToken(token);

    api.defaults.headers.common.Authorization =
      `Bearer ${token}`;
  }

  const tenantId =
    response.data
      ?.tenantId ||
    response.data
      ?.user?.tenantId;

  if (tenantId) {
    setTenant(
      tenantId
    );
  }

  return response;
}

export async function logout() {
  try {
    return await authApi.post(
      LOGOUT_ENDPOINT
    );
  } finally {
    clearAuthenticationState();
  }
}

export async function refreshToken() {
  const token =
    await refreshAccessToken();

  return {
    accessToken: token,
  };
}

// ============================================================================
// Authentication Bootstrap
// ============================================================================
//
// Recommended during application startup:
//
// await bootstrapAuthentication();
//
// This allows TITech to recover a session after a browser reload without
// persisting the access token in browser storage.
// ============================================================================

export async function bootstrapAuthentication() {
  try {
    const token =
      await refreshAccessToken();

    return {
      authenticated: true,
      accessToken: token,
    };
  } catch {
    clearAuthenticationState();

    return {
      authenticated: false,
      accessToken: null,
    };
  }
}

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

  Object.entries(extra)
    .forEach(
      ([key, value]) => {
        if (
          value === undefined ||
          value === null
        ) {
          return;
        }

        if (
          value instanceof Blob
        ) {
          form.append(
            key,
            value
          );
        } else {
          form.append(
            key,
            String(value)
          );
        }
      }
    );

  return api.post(
    url,
    form,
    {
      ...config,

      headers: {
        ...config.headers,

        // DO NOT manually set Content-Type.
        //
        // The browser must generate:
        // multipart/form-data; boundary=...
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
  return api.get(
    url,
    {
      ...config,
      responseType: "blob",
    }
  );
}

// ============================================================================
// Generic HTTP Methods
// ============================================================================

export function get(
  url,
  config
) {
  return api.get(
    url,
    config
  );
}

export function post(
  url,
  data,
  config
) {
  return api.post(
    url,
    data,
    config
  );
}

export function put(
  url,
  data,
  config
) {
  return api.put(
    url,
    data,
    config
  );
}

export function patch(
  url,
  data,
  config
) {
  return api.patch(
    url,
    data,
    config
  );
}

export function del(
  url,
  config
) {
  return api.delete(
    url,
    config
  );
}

// ============================================================================
// Financial Request Helper
// ============================================================================
//
// Use this for financial mutations where the application needs to create
// the idempotency key BEFORE the request.
//
// Example:
//
// const idempotencyKey = generateIdempotencyKey();
//
// createFinancialRequest(
//   "POST",
//   "/api/savings/deposit",
//   payload,
//   {
//     headers: {
//       "Idempotency-Key": idempotencyKey,
//     },
//   }
// );
//
// The same key can be persisted alongside an offline event.
// ============================================================================

export function createFinancialRequest(
  method,
  url,
  data,
  config = {}
) {
  const existingHeaders =
    config.headers || {};

  const headers = {
    ...existingHeaders,

    "Idempotency-Key":
      existingHeaders[
        "Idempotency-Key"
      ] ||
      existingHeaders[
        "idempotency-key"
      ] ||
      uuidv4(),

    "x-transaction-id":
      existingHeaders[
        "x-transaction-id"
      ] ||
      uuidv4(),
  };

  return api.request({
    ...config,

    method,
    url,
    data,

    headers,
  });
}

// ============================================================================
// Request Cancellation
// ============================================================================

export function cancelRequest(
  config
) {
  const key =
    requestKey(config);

  const controller =
    requestControllers.get(
      key
    );

  if (!controller) {
    return false;
  }

  try {
    controller.abort();
  } finally {
    requestControllers.delete(
      key
    );

    pendingRequests.delete(
      key
    );
  }

  return true;
}

// ============================================================================
// Diagnostics
// ============================================================================
//
// Diagnostics deliberately expose only operational metadata.
// Never expose access tokens, refresh tokens, passwords, secrets, or financial
// payloads here.
// ============================================================================

export function getApiDiagnostics() {
  return {
    apiBase:
      API_BASE,

    authenticated:
      Boolean(
        getToken()
      ),

    tenantId:
      getTenant(),

    deviceId:
      getDeviceId(),

    online:
      typeof navigator !==
        "undefined"
        ? navigator.onLine
        : true,

    refreshInProgress:
      Boolean(
        refreshPromise
      ),

    pendingRequests:
      pendingRequests.size,

    pendingRequestDetails:
      IS_DEV
        ? Array.from(
            pendingRequests.entries()
          ).map(
            ([key, value]) => ({
              key,
              ...value,
            })
          )
        : undefined,

    environment:
      IS_DEV
        ? "development"
        : "production",

    appVersion:
      APP_VERSION,
  };
}

// ============================================================================
// API Health Check
// ============================================================================
//
// navigator.onLine only tells us whether the browser believes it has network
// connectivity.
//
// This function actually tests TITech API reachability.
// ============================================================================

export async function checkApiHealth() {
  const startedAt =
    Date.now();

  try {
    const response =
      await authApi.get(
        "/health",
        {
          timeout:
            HEALTH_TIMEOUT,
        }
      );

    return {
      healthy: true,

      status:
        response.status,

      latency:
        Date.now() -
        startedAt,
    };
  } catch (error) {
    return {
      healthy: false,

      status:
        error?.response
          ?.status ||
        null,

      latency:
        Date.now() -
        startedAt,

      message:
        error?.message ||
        "TITech API unavailable",
    };
  }
}

// ============================================================================
// Network State Helpers
// ============================================================================

export function isOnline() {
  return !isBrowserOffline();
}

export function isOffline() {
  return isBrowserOffline();
}

// ============================================================================
// Network State Events
// ============================================================================
//
// The offline queue/synchronization engine should remain outside this API
// client.
//
// This client only reports network state.
// ============================================================================

export function onNetworkStateChange(
  callback
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return () => {};
  }

  if (
    typeof callback !==
    "function"
  ) {
    return () => {};
  }

  const handleOnline =
    () => {
      callback({
        online: true,
      });
    };

  const handleOffline =
    () => {
      callback({
        online: false,
      });
    };

  window.addEventListener(
    "online",
    handleOnline
  );

  window.addEventListener(
    "offline",
    handleOffline
  );

  return () => {
    window.removeEventListener(
      "online",
      handleOnline
    );

    window.removeEventListener(
      "offline",
      handleOffline
    );
  };
}

// ============================================================================
// Financial Safety Utilities
// ============================================================================

export function generateIdempotencyKey() {
  return uuidv4();
}

export function generateTransactionId() {
  return uuidv4();
}

// ============================================================================
// Export
// ============================================================================

export default api;