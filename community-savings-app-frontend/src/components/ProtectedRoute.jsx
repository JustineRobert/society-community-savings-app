// src/components/ProtectedRoute.jsx

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

// Checks JWT token expiry
const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const auth = useAuth();
  const [isValid, setIsValid] = useState(null); // null = loading state

  useEffect(() => {
    const validateAuth = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!auth || typeof auth.logout !== 'function') {
          toast.error('Authentication context error');
          setIsValid(false);
          return;
        }

        if (!token || isTokenExpired(token)) {
          await auth.logout();
          toast.error('Session expired. Please login again.');
          setIsValid(false);
        } else {
          setIsValid(true);
        }
      } catch (error) {
        console.error('Auth validation error:', error);
        setIsValid(false);
      }
    };

    validateAuth();
  }, [auth]);

  if (isValid === null) return <LoadingSpinner />;
  return isValid ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
