// ============================================================================
// TITech Community Capital
// Enterprise Auth Context (Production Grade)
// File: frontend/src/context/AuthContext.jsx
// ============================================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import socket, { connectSocket } from '../services/socket';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'token';
const SESSION_KEY = 'has_session';
const REFRESH_BUFFER_SECONDS = 120; // refresh this many seconds before expiry

// ---------------------------------------------------------------------------
// Axios instance (shared)
// ---------------------------------------------------------------------------
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

// ---------------------------------------------------------------------------
// Helpers: JWT parsing and timing
// ---------------------------------------------------------------------------
function parseJwt(token) {
  try {
    if (!token) return null;
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = parseJwt(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 <= Date.now();
}

function getRefreshDelay(token) {
  const payload = parseJwt(token);
  if (!payload?.exp) return null;
  const refreshAt = payload.exp * 1000 - REFRESH_BUFFER_SECONDS * 1000;
  return Math.max(refreshAt - Date.now(), 0);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // Refs for timers, concurrency control, and lifecycle
  const refreshTimerRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const mountedRef = useRef(false);
  const bootstrappedRef = useRef(false);
  const logoutInProgressRef = useRef(false);
  const retryQueueRef = useRef([]); // queued requests while refreshing

  // -------------------------------------------------------------------------
  // Token setter (centralized)
  // -------------------------------------------------------------------------
  const setToken = useCallback((accessToken) => {
    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(SESSION_KEY, 'true');
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    } else {
      localStorage.removeItem(TOKEN_KEY);
      delete api.defaults.headers.common.Authorization;
    }
    setTokenState(accessToken);
  }, []);

  // -------------------------------------------------------------------------
  // Socket helpers
  // -------------------------------------------------------------------------
  const connectUserSocket = useCallback(() => {
    try {
      connectSocket();
    } catch (err) {
      console.error('Socket connect error', err);
    }
  }, []);

  const disconnectUserSocket = useCallback(() => {
    try {
      socket.disconnect();
    } catch (_) {}
  }, []);

  // -------------------------------------------------------------------------
  // Refresh timer management
  // -------------------------------------------------------------------------
  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(
    (accessToken) => {
      clearRefreshTimer();
      if (!accessToken) return;

      const delay = getRefreshDelay(accessToken);
      if (delay === null || delay <= 0) return;

      refreshTimerRef.current = setTimeout(async () => {
        try {
          await refreshToken();
        } catch (err) {
          // refresh failed — logout silently to clear state
          await logout(true);
        }
      }, delay);
    },
    [clearRefreshTimer]
  );

  // -------------------------------------------------------------------------
  // Logout (idempotent, single-call)
  // Accepts silent flag to avoid toasts during background logout
  // -------------------------------------------------------------------------
  const logout = useCallback(
    async (silent = false) => {
      // Prevent concurrent logout calls
      if (logoutInProgressRef.current) return;
      logoutInProgressRef.current = true;

      try {
        // Attempt server logout but treat failures as non-fatal (idempotent)
        try {
          await api.post('/api/auth/logout');
        } catch (err) {
          // If server returns 401 or session missing, ignore — we still clear client state
          if (err?.response?.status && err.response.status !== 401) {
            console.warn('Logout endpoint returned error', err.response?.status);
          }
        }

        clearRefreshTimer();
        disconnectUserSocket();
        setUser(null);
        setToken(null);
        localStorage.removeItem(SESSION_KEY);

        if (!silent) {
          toast.info('Logged out successfully');
        }
      } finally {
        logoutInProgressRef.current = false;
      }
    },
    [clearRefreshTimer, disconnectUserSocket, setToken]
  );

  // -------------------------------------------------------------------------
  // Refresh token (single-flight)
  // - Throws if no session or refresh fails
  // -------------------------------------------------------------------------
  const refreshToken = useCallback(async () => {
    const hasSession = localStorage.getItem(SESSION_KEY);
    if (!hasSession) {
      throw new Error('No active session');
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      const response = await api.post('/api/auth/refresh');
      const accessToken = response.data?.token || response.data?.accessToken;
      if (!accessToken) {
        throw new Error('Refresh returned no token');
      }
      setToken(accessToken);
      scheduleRefresh(accessToken);
      return accessToken;
    })();

    try {
      return await refreshPromiseRef.current;
    } finally {
      refreshPromiseRef.current = null;
    }
  }, [scheduleRefresh, setToken]);

  // -------------------------------------------------------------------------
  // Login / Register
  // - Accepts optional options object (e.g., { signal }) for abort support
  // -------------------------------------------------------------------------
  const login = useCallback(
    async (email, password, deviceInfo = {}, options = {}) => {
      const response = await api.post('/api/auth/login', { email, password, deviceInfo }, options);
      const accessToken = response.data?.token || response.data?.accessToken;
      const profile = response.data?.user || null;

      if (!accessToken) {
        throw new Error('Login returned no token');
      }

      setToken(accessToken);
      setUser(profile);
      scheduleRefresh(accessToken);
      connectUserSocket();
      toast.success('Login successful');
      return profile;
    },
    [setToken, scheduleRefresh, connectUserSocket]
  );

  const register = useCallback(
    async (email, password, name, options = {}) => {
      const response = await api.post('/api/auth/register', { email, password, name }, options);
      const accessToken = response.data?.token || response.data?.accessToken;
      const profile = response.data?.user || null;

      if (!accessToken) {
        throw new Error('Registration returned no token');
      }

      setToken(accessToken);
      setUser(profile);
      scheduleRefresh(accessToken);
      connectUserSocket();
      toast.success('Registration successful');
      return profile;
    },
    [setToken, scheduleRefresh, connectUserSocket]
  );

  // -------------------------------------------------------------------------
  // Axios interceptors
  // - Request interceptor ensures Authorization header is present
  // - Response interceptor handles 401 by attempting refresh and retrying queued requests
  // -------------------------------------------------------------------------
  useEffect(() => {
    const reqInterceptor = api.interceptors.request.use(
      (config) => {
        // Ensure Authorization header is present if token exists
        if (token && !config.headers?.Authorization) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const resInterceptor = api.interceptors.response.use(
      (res) => res,
      async (error) => {
        const original = error.config;

        // If no response (network error), just reject
        if (!error.response) return Promise.reject(error);

        // If request already retried, reject
        if (original?._retry) return Promise.reject(error);

        // Do not attempt refresh for refresh endpoint itself
        if (original?.url?.includes('/api/auth/refresh')) return Promise.reject(error);

        // Only handle 401s
        if (error.response.status !== 401) return Promise.reject(error);

        // Mark original as retrying
        original._retry = true;

        try {
          // Attempt to refresh token (single-flight)
          const newToken = await refreshToken();

          // Update original request Authorization and retry
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;

          return api(original);
        } catch (err) {
          // Refresh failed: perform silent logout and reject
          await logout(true);
          return Promise.reject(err);
        }
      }
    );

    return () => {
      api.interceptors.request.eject(reqInterceptor);
      api.interceptors.response.eject(resInterceptor);
    };
  }, [token, refreshToken, logout]);

  // -------------------------------------------------------------------------
  // Session restore on mount
  // - If token present and not expired, call /me to hydrate user
  // - Otherwise, if had session, attempt refresh
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    mountedRef.current = true;

    (async () => {
      try {
        const existingToken = localStorage.getItem(TOKEN_KEY);

        if (existingToken && !isTokenExpired(existingToken)) {
          setToken(existingToken);
          try {
            const me = await api.get('/api/auth/me');
            if (!mountedRef.current) return;
            setUser(me.data);
            scheduleRefresh(existingToken);
            connectUserSocket();
            return;
          } catch (err) {
            // If /me fails, fall through to refresh flow
            console.warn('Failed to fetch /me with existing token', err);
          }
        }

        const hadSession = localStorage.getItem(SESSION_KEY);
        if (!hadSession) return;

        try {
          const newToken = await refreshToken();
          const me = await api.get('/api/auth/me');
          if (!mountedRef.current) return;
          setUser(me.data);
          scheduleRefresh(newToken);
          connectUserSocket();
        } catch (err) {
          // Refresh failed — clear client state silently
          await logout(true);
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      clearRefreshTimer();
    };
  }, [
    refreshToken,
    scheduleRefresh,
    setToken,
    connectUserSocket,
    logout,
    clearRefreshTimer,
  ]);

  // -------------------------------------------------------------------------
  // Cross-tab logout listener
  // -------------------------------------------------------------------------
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === TOKEN_KEY) {
        if (!event.newValue) {
          // token removed in another tab
          setUser(null);
          setTokenState(null);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      authenticated: !!user,
      login,
      register,
      logout,
      refreshToken,
      api, // expose axios instance for convenience
    }),
    [user, token, loading, login, register, logout, refreshToken]
  );

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export default AuthContext;
