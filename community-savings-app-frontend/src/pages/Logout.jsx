// ============================================================================
// TITech Community Capital – Logout Page
// File: frontend/src/pages/Logout.jsx
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

/**
 * Production-grade Logout page
 *
 * - Calls auth.logout() exactly once while mounted
 * - Guards against duplicate calls when user is already unauthenticated
 * - Uses AbortController if logout supports aborting
 * - Handles "already signed out" gracefully and redirects
 * - Accessible loading UI and clear toasts
 */
export default function Logout() {
  const auth = useAuth();
  const { authenticated, loading: authLoading, logout } = auth ?? {};
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const calledRef = useRef(false);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const logoutInProgressRef = useRef(false);

  // Optional redirect target: ?next=/some/path
  const params = new URLSearchParams(location.search);
  const next = params.get('next') || '/login';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Abort any in-flight logout if supported
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
        } catch (_) {}
      }
    };
  }, []);

  useEffect(() => {
    // Wait for auth initialization
    if (authLoading) return;

    // Ensure we only run once
    if (calledRef.current) return;
    calledRef.current = true;

    // If not authenticated, avoid calling logout endpoint
    if (!authenticated) {
      toast.info('You are already signed out.');
      navigate(next, { replace: true });
      return;
    }

    // Prevent concurrent logout attempts
    if (logoutInProgressRef.current) return;

    const performLogout = async () => {
      logoutInProgressRef.current = true;
      setIsLoggingOut(true);

      // Provide AbortController in case logout supports it
      abortControllerRef.current = new AbortController();

      try {
        // Pass signal if logout supports options
        await logout?.({ signal: abortControllerRef.current.signal });

        if (!mountedRef.current) return;

        toast.success('You have been logged out.');
        navigate(next, { replace: true });
      } catch (err) {
        // If aborted, do nothing
        if (err?.name === 'AbortError') return;

        // Treat "no active session" or 401 from logout as success (idempotent)
        const status = err?.response?.status ?? err?.status;
        const message = String(err?.message ?? '').toLowerCase();

        const alreadySignedOut =
          status === 401 ||
          message.includes('no active session') ||
          message.includes('already signed out') ||
          message.includes('no session');

        if (alreadySignedOut) {
          toast.info('You were already signed out.');
          navigate(next, { replace: true });
          return;
        }

        // Generic failure: log and redirect to login to clear client state
        // eslint-disable-next-line no-console
        console.error('Logout failed', err);
        toast.error('Logout failed. Redirecting to login.');

        // Ensure local state cleared by redirecting to login
        navigate('/login', { replace: true });
      } finally {
        logoutInProgressRef.current = false;
        if (mountedRef.current) setIsLoggingOut(false);
      }
    };

    performLogout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authenticated, logout, navigate, next]);

  return (
    <main
      role="status"
      aria-live="polite"
      className="flex items-center justify-center min-h-screen p-6 bg-gray-50"
    >
      <div className="text-center max-w-md">
        <svg
          className={`mx-auto mb-4 ${isLoggingOut ? 'animate-spin' : ''}`}
          width="56"
          height="56"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="#e6eef8" strokeWidth="4" fill="none" />
          <path
            d="M22 12a10 10 0 00-10-10"
            stroke="#2563eb"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        <h1 className="text-xl font-semibold mb-2">
          {isLoggingOut ? 'Signing you out…' : 'Signing out'}
        </h1>

        <p className="text-sm text-gray-600 mb-4">
          {isLoggingOut
            ? 'Finishing up — you will be redirected shortly.'
            : 'Preparing to sign you out.'}
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              // Allow user to force-redirect to login if logout seems stuck
              navigate('/login', { replace: true });
            }}
            className="px-4 py-2 rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            Go to Login
          </button>
          <button
            type="button"
            onClick={() => {
              // Retry only if not currently logging out
              if (!logoutInProgressRef.current && !isLoggingOut) {
                // Reset calledRef so effect can run again if needed
                calledRef.current = false;
                // Trigger effect by navigating to same route (force re-render)
                navigate(location.pathname + location.search, { replace: true });
              }
            }}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Signing out…' : 'Retry'}
          </button>
        </div>
      </div>
    </main>
  );
}
