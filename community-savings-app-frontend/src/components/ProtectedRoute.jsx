// src/components/ProtectedRoute.jsx

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Simple loading placeholder
const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
    <div>Loading...</div>
  </div>
);

/**
 * ProtectedRoute
 * - If not authenticated -> redirect to /login
 * - If requiredRoles provided -> ensure user.role matches one of them
 * Usage: <Route element={<ProtectedRoute requiredRoles={["admin"]} />}>
 */
const ProtectedRoute = ({ requiredRoles = [], children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRoles && requiredRoles.length > 0) {
    const has = requiredRoles.includes((user.role || '').toString());
    if (!has) return <Navigate to="/403" replace />;
  }

  // If children provided, render them; otherwise use Outlet for nested routes
  return children ? children : <Outlet />;
};

export default ProtectedRoute;
