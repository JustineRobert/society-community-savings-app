
// src/context/AuthContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
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

// Create an axios instance we can attach interceptors to
// Set a reasonable timeout so the auth initialization cannot hang
const api = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 5000 });

// Track refresh attempts to prevent cascading failures
let refreshPromise = null;

/**
 * Calculate exponential backoff delay in milliseconds
 * Attempt 1: 100ms, Attempt 2: 200ms, Attempt 3: 400ms
 */
const getBackoffDelay = (attempt) => {
  return Math.min(100 * Math.pow(2, attempt - 1), 1000);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // core logout used internally
  const doLogout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      // ignore
    } finally {
      setToken(null);
      setUser(null);
      toast.info('Logged out');
    }
  }, []);

  // Attach Authorization header when token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }, [token]);

  // Response interceptor: on 401 try refresh with exponential backoff, then retry request
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = error.config;
        
        // Prevent infinite retry loops
        if (!originalRequest || originalRequest._retry) return Promise.reject(error);
        
        // Only attempt refresh on 401 Unauthorized
        if (error.response?.status === 401) {
          originalRequest._retry = true;
          
          try {
            // Use a shared promise to prevent multiple concurrent refresh attempts
            if (!refreshPromise) {
              refreshPromise = (async () => {
                const refreshRes = await api.post('/api/auth/refresh');
                // Handle both 'token' (old) and 'accessToken' (new) response formats
                const newToken = refreshRes.data.token || refreshRes.data.accessToken;
                if (!newToken) {
                  throw new Error('No token in refresh response');
                }
                setToken(newToken);
                return newToken;
              })();
            }
            
            const newToken = await refreshPromise;
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return api(originalRequest);
          } catch (e) {
            // Refresh failed - logout user
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
  }, [doLogout]);

  // Public logout
  const logout = useCallback(async () => {
    await doLogout();
  }, [doLogout]);

  // Refresh access token explicitly with exponential backoff and retry
  const refreshAccessToken = useCallback(async () => {
    const MAX_REFRESH_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_REFRESH_ATTEMPTS; attempt++) {
      try {
        const res = await api.post('/api/auth/refresh');
        // Handle both 'token' (old) and 'accessToken' (new) response formats
        const newToken = res.data.token || res.data.accessToken;
        if (!newToken) {
          throw new Error('No token in refresh response');
        }
        setToken(newToken);
        return newToken;
      } catch (err) {
        // Only retry on specific errors (network, 5xx, 429)
        const status = err.response?.status;
        const shouldRetry = !status || status >= 500 || status === 429;
        
        if (shouldRetry && attempt < MAX_REFRESH_ATTEMPTS) {
          // Wait with exponential backoff before retrying
          const delay = getBackoffDelay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Final attempt failed or non-retryable error
        await doLogout();
        throw err;
      }
    }
  }, [doLogout]);

  // Login
  const login = useCallback(async (email, password, deviceInfo) => {
    try {
      const res = await api.post('/api/auth/login', { email, password, deviceInfo });
      // Normalize token field names across possible backend responses
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

  // Initialize: attempt to refresh token to populate session
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = localStorage.getItem('token');
        if (stored) {
          // try to validate stored token by calling /api/auth/me
          api.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
          try {
            const meRes = await api.get('/api/auth/me');
            if (!mounted) return;
            setUser(meRes.data);
            setToken(stored);
            return;
          } catch (_) {
            // invalid stored token, attempt refresh
          }
        }

        // attempt refresh (cookie-based)
        // Use a race against a manual timeout to ensure this initialization
        // cannot hang indefinitely if the backend is unreachable.
        const refreshPromise = api.post('/api/auth/refresh');
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('refresh timeout')), 5000));
        const refreshRes = await Promise.race([refreshPromise, timeoutPromise]);
        // Handle both 'token' (old) and 'accessToken' (new) response formats
        const newToken = refreshRes.data?.token || refreshRes.data?.accessToken;
        if (newToken) {
          if (!mounted) return;
          setToken(newToken);
          // fetch user
          const meRes = await api.get('/api/auth/me');
          if (!mounted) return;
          setUser(meRes.data);
        }
      } catch (err) {
        // not authenticated; silently proceed
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const value = { user, token, loading, login, logout, register, refreshToken: refreshAccessToken };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
