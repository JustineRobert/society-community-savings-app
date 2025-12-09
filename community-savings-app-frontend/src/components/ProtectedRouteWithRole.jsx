// src/components/ProtectedRouteWithRole.jsx

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';

/**
 * Utility: Checks if the JWT token is expired
 * @param {string} token - JWT token
 * @returns {boolean} true if token is expired
 */
const isTokenExpired = (token) => {
  try {
    const decoded = jwtDecode(token);
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

/**
 * Component: Protects route access based on authentication and user role
 * @param {JSX.Element} children - Component to render if authorized
 * @param {Array} allowedRoles - List of roles allowed to access the route
 * @returns {JSX.Element} Authorized children or redirect to login
 */
const ProtectedRouteWithRole = ({ children, allowedRoles }) => {
  const { logout } = useAuth(); // ✅ Removed unused 'user'
  const [isAuthorized, setIsAuthorized] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token || isTokenExpired(token)) {
      logout();
      toast.error('Session expired. Please log in again.');
      setIsAuthorized(false);
      return;
    }

    try {
      const decoded = jwtDecode(token);
      const userRole = decoded.role;

      if (!allowedRoles.includes(userRole)) {
        toast.warning('You do not have permission to access this page.');
        setIsAuthorized(false);
      } else {
        setIsAuthorized(true);
      }
    } catch {
      setIsAuthorized(false);
      toast.error('Invalid session.');
    }
  }, [allowedRoles, logout]);

  if (isAuthorized === null) return null; // Optional: Add a loading UI

  return isAuthorized ? children : <Navigate to="/login" replace />;
};

export default ProtectedRouteWithRole;
