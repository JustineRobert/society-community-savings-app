// src/pages/Logout.js

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

/**
 * Logout route component:
 * - Performs logout with feedback
 * - Shows spinner while logging out
 * - Prevents duplicate logout calls
 */
const Logout = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (isLoggingOut) return;

    const performLogout = async () => {
      setIsLoggingOut(true);
      try {
        await logout(); // Wait for full cleanup
        toast.info('You have been logged out.');
        navigate('/login');
      } catch (error) {
        toast.error('Logout failed. Please try again.');
      } finally {
        setIsLoggingOut(false);
      }
    };

    performLogout();
  }, [logout, navigate, isLoggingOut]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg font-medium animate-pulse">Logging out...</p>
    </div>
  );
};

export default Logout;
