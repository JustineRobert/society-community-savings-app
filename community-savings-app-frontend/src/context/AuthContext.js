
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
const api = axios.create({ baseURL: API_BASE, withCredentials: true });

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

  // Response interceptor: on 401 try refresh once, then retry request
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = error.config;
        if (!originalRequest || originalRequest._retry) return Promise.reject(error);
        if (error.response?.status === 401) {
          originalRequest._retry = true;
          try {
            const refreshRes = await api.post('/api/auth/refresh');
            const newToken = refreshRes.data.token;
            setToken(newToken);
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return api(originalRequest);
          } catch (e) {
            // Refresh failed
            await doLogout(); // <-- referenced here
            return Promise.reject(e);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => api.interceptors.response.eject(interceptor);
  }, [doLogout]); // ✅ include doLogout to satisfy react-hooks/exhaustive-deps

  // Public logout
  const logout = useCallback(async () => {
    await doLogout();
  }, [doLogout]);

  // Refresh access token explicitly
  const refreshAccessToken = useCallback(async () => {
    try {
      const res = await api.post('/api/auth/refresh');
      const newToken = res.data.token;
      setToken(newToken);
      return newToken;
    } catch (err) {
      await doLogout();
      throw err;
    }
  }, [doLogout]);

  // Login
  const login = useCallback(async (email, password, deviceInfo) => {
    try {
      const res = await api.post('/api/auth/login', { email, password, deviceInfo });
      const newToken = res.data.token;
      const userData = res.data.user;
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
      const newToken = res.data.token;
      const userData = res.data.user;
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
        const refreshRes = await api.post('/api/auth/refresh');
        if (refreshRes?.data?.token) {
          if (!mounted) return;
          setToken(refreshRes.data.token);
          // fetch user
          const meRes = await api.get('/api/auth/me');
          if (!mounted) return;
          setUser(meRes.data);
        }
      } catch (err) {
        // not authenticated
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
