// ============================================================================
// TITech Community Capital – Forgot Password Page
// File: frontend/src/pages/ForgotPassword.jsx
// Production-grade
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';
import api from '../services/api'; // axios instance or fetch wrapper
import logger from "../utils/logger"; // optional client logger

/**
 * ForgotPassword
 *
 * - Accessible form with client-side validation
 * - Debounced submit protection and AbortController support
 * - Friendly UX: success screen with next steps, resend cooldown
 * - Defensive error handling and telemetry hooks
 *
 * Usage:
 * <ForgotPassword />
 */
export default function ForgotPassword({ redirectTo = '/login', cooldownSeconds = 60 }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const mountedRef = useRef(true);
  const cooldownTimerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (_) {}
      }
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  // Simple email validation
  const isValidEmail = useCallback((value) => {
    if (!value) return false;
    const v = String(value).trim();
    // RFC-lite regex for client-side validation
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return re.test(v);
  }, []);

  // Start cooldown timer
  const startCooldown = useCallback(
    (seconds) => {
      setCooldown(seconds);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    },
    [setCooldown]
  );

  // Submit handler
  const handleSubmit = useCallback(
    async (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      setError(null);

      if (!isValidEmail(email)) {
        setError('Please enter a valid email address');
        return;
      }

      if (submitting) return; // debounce double submit

      setSubmitting(true);
      abortRef.current = new AbortController();

      try {
        // POST to backend endpoint that triggers password reset email
        // Expectation: 200/202 on success, 400/404 for invalid input, 429 for rate limit
        await api.post(
          '/api/auth/forgot-password',
          { email: String(email).trim().toLowerCase() },
          { signal: abortRef.current.signal }
        );

        if (!mountedRef.current) return;

        setSent(true);
        toast.success('If an account exists for that email, a reset link has been sent.');
        startCooldown(cooldownSeconds);

        // Optionally navigate to a "check your email" page
        // navigate('/check-email', { state: { email } });
      } catch (err) {
        if (err?.name === 'AbortError') {
          // aborted by user navigation or component unmount
          return;
        }

        // Extract meaningful message
        const serverMsg =
          err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Request failed';

        // Rate limit handling
        if (err?.response?.status === 429) {
          setError('Too many requests. Please try again later.');
          startCooldown(cooldownSeconds);
          toast.warn('Too many requests. Please wait before trying again.');
        } else {
          setError(serverMsg);
          toast.error(serverMsg);
        }

        // Log for diagnostics (no sensitive data)
        try {
          logger?.warn?.('ForgotPassword request failed', { email: String(email).slice(0, 6), error: serverMsg });
        } catch (_) {}
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [email, isValidEmail, submitting, startCooldown, cooldownSeconds, navigate]
  );

  // Resend handler (same as submit but respects cooldown)
  const handleResend = useCallback(
    async (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (cooldown > 0) return;
      await handleSubmit();
    },
    [cooldown, handleSubmit]
  );

  // Quick helper to render the success state
  const renderSuccess = () => (
    <div className="forgot-password-success" role="status" aria-live="polite">
      <h2 className="text-xl font-semibold mb-2">Check your email</h2>
      <p className="mb-4 text-sm text-gray-700">
        If an account exists for <strong>{email}</strong>, we sent a password reset link. The link will expire
        shortly.
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => navigate(redirectTo)}
          className="btn-primary"
          aria-label="Return to login"
        >
          Return to login
        </button>

        <button
          type="button"
          onClick={handleResend}
          className="btn-secondary"
          disabled={cooldown > 0 || submitting}
          aria-disabled={cooldown > 0 || submitting}
        >
          {cooldown > 0 ? `Resend (${cooldown}s)` : submitting ? 'Sending…' : 'Resend email'}
        </button>
      </div>
    </div>
  );

  return (
    <main className="max-w-md mx-auto p-6">
      <section aria-labelledby="forgot-password-heading" className="bg-white p-6 rounded shadow">
        <h1 id="forgot-password-heading" className="text-2xl font-semibold mb-2">
          Forgot your password
        </h1>

        <p className="text-sm text-gray-600 mb-4">
          Enter the email address associated with your account and we'll send a link to reset your password.
        </p>

        {sent ? (
          renderSuccess()
        ) : (
          <form onSubmit={handleSubmit} noValidate aria-describedby="forgot-error">
            <div className="mb-4">
              <label htmlFor="forgot-email" className="block text-sm font-medium mb-1">
                Email address
              </label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field w-full"
                placeholder="you@example.com"
                aria-invalid={!!error}
                aria-describedby={error ? 'forgot-error' : undefined}
                required
                disabled={submitting}
              />
            </div>

            {error && (
              <div id="forgot-error" role="alert" className="error-message mb-4">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting || !isValidEmail(email)}
                aria-disabled={submitting || !isValidEmail(email)}
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>

              <button
                type="button"
                className="btn-ghost"
                onClick={() => navigate(redirectTo)}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

ForgotPassword.propTypes = {
  redirectTo: PropTypes.string,
  cooldownSeconds: PropTypes.number,
};
