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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Setup axios interceptor to include token in all requests
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
          config.headers['x-auth-token'] = storedToken;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  // Refresh token helper
  // Logout
  const logout = useCallback(async () => {
    try {
      await axios.post(`${API_BASE}/api/auth/logout`, {}, {
        withCredentials: true,
      });
    } catch (error) {
      console.error('Logout error:', error.message);
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      toast.info('Logged out successfully');
    }
  }, []);

  // Refresh token helper
  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await axios.post(`${API_BASE}/api/auth/refresh`, {}, {
        withCredentials: true,
      });
      const newToken = response.data.token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      return newToken;
    } catch (error) {
      console.error('Token refresh failed:', error.message);
      logout();
      throw error;
    }
  }, [logout]);

  // Login with email and password
  const login = useCallback(async (email, password) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/auth/login`,
        { email, password },
        { withCredentials: true }
      );

      const { token: newToken, user: userData } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      toast.success('Logged in successfully');
      return userData;
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Login failed. Please try again.';
      console.error('Login error:', errorMsg);
      toast.error(errorMsg);
      throw error;
    }
  }, []);

  // Register new user
  const register = useCallback(async (email, password, name) => {
    try {
      const response = await axios.post(
        `${API_BASE}/api/auth/register`,
        { email, password, name },
        { withCredentials: true }
      );

      const { token: newToken, user: userData } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      toast.success('Registration successful');
      return userData;
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Registration failed. Please try again.';
      console.error('Register error:', errorMsg);
      toast.error(errorMsg);
      throw error;
    }
  }, []);


  // Initialize user on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        
        if (storedToken) {
          // Verify token is still valid by checking with backend
          try {
            const response = await axios.get(`${API_BASE}/api/auth/me`, {
              headers: { 'x-auth-token': storedToken },
            });
            setUser(response.data);
            setToken(storedToken);
          } catch (error) {
            // Token invalid or expired
            localStorage.removeItem('token');
            console.warn('Stored token is invalid, clearing...');
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error.message);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    register,
    refreshToken: refreshAccessToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};