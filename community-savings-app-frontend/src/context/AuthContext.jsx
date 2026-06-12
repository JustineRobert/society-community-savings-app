// src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import socket, { connectSocket } from '../services/socket';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AuthContext = createContext({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  register: async () => {},
  refreshToken: async () => {},
});

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 10000,
});

// Helper: parse JWT and return payload or null
function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Helper: compute ms until refresh (refreshBuffer seconds before expiry)
function msUntilRefresh(token, refreshBuffer = 120) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return null;
  const expMs = payload.exp * 1000;
  const refreshAt = expMs - refreshBuffer * 1000;
  const now = Date.now();
  return Math.max(refreshAt - now, 0);
}

let refreshPromise = null;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const refreshTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // Sync axios + localStorage when token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
      // reconnect socket with latest JWT
      connectSocket();
      scheduleRefresh(token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
      socket.disconnect();
      clearScheduledRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Socket listeners
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('presence:updated', (data) => {
      console.log('Presence update:', data);
    });

    socket.on('notification', (data) => {
      toast.info(data?.message || 'You have a new notification');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('presence:updated');
      socket.off('notification');
    };
  }, []);

  // Axios response interceptor: handle 401 with refresh dedupe
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = error.config;
        if (!originalRequest || originalRequest._retry) {
          return Promise.reject(error);
        }

        // If no response (network error / backend down), don't attempt refresh
        if (!error.response) {
          return Promise.reject(error);
        }

        if (error.response.status === 401) {
          originalRequest._retry = true;

          try {
            if (!refreshPromise) {
              refreshPromise = (async () => {
                const refreshRes = await api.post('/api/auth/refresh');
                const newToken = refreshRes.data.token || refreshRes.data.accessToken;
                if (!newToken) throw new Error('No token in refresh response');
                setToken(newToken);
                return newToken;
              })();
            }

            const newToken = await refreshPromise;
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return api(originalRequest);
          } catch (e) {
            // refresh failed -> force logout
            await doLogout();
            return Promise.reject(e);
          } finally {
            refreshPromise = null;
          }
        }

        return Promise.reject(error);
      }
    );

    return () => api.interceptors.response.eject(interceptor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // schedule refresh timer (clears previous)
  const scheduleRefresh = useCallback((currentToken) => {
    clearScheduledRefresh();
    if (!currentToken) return;

    const ms = msUntilRefresh(currentToken, 120); // refresh 120s before expiry
    if (ms === null) return;

    // If token already near expiry, refresh immediately (but debounce via refreshPromise)
    if (ms <= 1000) {
      (async () => {
        try {
          await refreshAccessToken();
        } catch (err) {
          // refreshAccessToken handles logout on failure
        }
      })();
      return;
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        await refreshAccessToken();
      } catch (err) {
        // refreshAccessToken handles logout on failure
      }
    }, ms);
  }, []);

  const clearScheduledRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Core logout helper
  const doLogout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (_) {
      // ignore network errors
    } finally {
      setToken(null);
      setUser(null);
      clearScheduledRefresh();
      toast.info('Logged out');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Public logout
  const logout = useCallback(async () => {
    await doLogout();
  }, [doLogout]);

  // Refresh access token (deduped)
  const refreshAccessToken = useCallback(async () => {
    if (!token && !localStorage.getItem('token')) {
      throw new Error('No token available to refresh');
    }

    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const res = await api.post('/api/auth/refresh');
          const newToken = res.data.token || res.data.accessToken;
          if (!newToken) throw new Error('No token in refresh response');
          setToken(newToken);
          return newToken;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    return refreshPromise;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Login
  const login = useCallback(async (email, password, deviceInfo) => {
    try {
      const res = await api.post('/api/auth/login', { email, password, deviceInfo });
      const newToken = res.data.token || res.data.accessToken || res.data.access_token;
      const userData = res.data.user || res.data.userData || res.data;

      setToken(newToken);
      setUser(userData);

      toast.success('Logged in');
      return userData;
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      toast.error(message);
      throw err;
    }
  }, []);

  // Register
  const register = useCallback(async (email, password, name) => {
    try {
      const res = await api.post('/api/auth/register', { email, password, name });
      const newToken = res.data.token || res.data.accessToken || res.data.access_token;
      const userData = res.data.user || res.data.userData || res.data;

      setToken(newToken);
      setUser(userData);

      toast.success('Registered');
      return userData;
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw err;
    }
  }, []);

  // Initial load: try stored token -> /me, otherwise try refresh
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const stored = localStorage.getItem('token');
        if (stored) {
          api.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
          try {
            const meRes = await api.get('/api/auth/me');
            if (!mountedRef.current) return;
            setUser(meRes.data);
            setToken(stored);
            return;
          } catch (_) {
            // stored token invalid, fall through to refresh attempt
          }
        }

        // Try refresh once on startup (backend may return 404 if route missing)
        try {
          const refreshRes = await api.post('/api/auth/refresh');
          const newToken = refreshRes.data?.token || refreshRes.data?.accessToken;
          if (newToken && mountedRef.current) {
            setToken(newToken);
            const meRes = await api.get('/api/auth/me');
            if (!mountedRef.current) return;
            setUser(meRes.data);
          }
        } catch (err) {
          // initial refresh failed; likely backend offline or route not implemented
          console.warn('Initial refresh skipped or failed:', err?.response?.status || err.message);
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      clearScheduledRefresh();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose refreshToken for manual use
  const refreshToken = useCallback(async () => {
    return refreshAccessToken();
  }, [refreshAccessToken]);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    register,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
