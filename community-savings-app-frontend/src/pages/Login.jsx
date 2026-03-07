// src/pages/Login.jsx
/**
 * Login Component
 * Handles user authentication with production-ready features:
 * - Secure password handling
 * - Form validation with Yup
 * - Remember me functionality
 * - Error handling and user feedback
 * - Accessibility (WCAG 2.1 AA compliant)
 * - Rate limiting protection indication
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Info } from 'lucide-react';
import './Login.css';

// Validation Schema with production-ready rules
// Security constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

const LoginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required')
    .max(254, 'Email is too long')
    .matches(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please enter a valid email address'
    ),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .required('Password is required'),
});

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(null);

  // Safely get saved email from localStorage
  const getSavedEmail = useCallback(() => {
    try {
      const saved = localStorage.getItem('savedEmail');
      // Validate it's a proper email
      return saved && Yup.string().email().isValidSync(saved) ? saved : '';
    } catch {
      return '';
    }
  }, []);

  const getRememberMeStatus = useCallback(() => {
    try {
      return localStorage.getItem('rememberMe') === 'true';
    } catch {
      return false;
    }
  }, []);

  // Initialize remembered settings safely
  useEffect(() => {
    try {
      const attempts = localStorage.getItem('loginAttempts');
      const lockout = localStorage.getItem('loginLockout');

      if (lockout && new Date(lockout) > new Date()) {
        setLockoutTime(new Date(lockout));
      } else {
        localStorage.removeItem('loginLockout');
        localStorage.removeItem('loginAttempts');
        setAttemptCount(0);
      }

      setAttemptCount(attempts ? parseInt(attempts, 10) : 0);
    } catch (err) {
      console.error('Error initializing login state:', err);
    }
  }, []);

  // Handle login with security checks
  const handleLogin = useCallback(async (values, { setSubmitting }) => {
    // Check lockout status
    if (lockoutTime && new Date() < new Date(lockoutTime)) {
      const remainingMins = Math.ceil(
        (new Date(lockoutTime) - new Date()) / 60000
      );
      toast.error(
        `Too many failed attempts. Please try again in ${remainingMins} minute(s).`
      );
      setSubmitting(false);
      return;
    }

    setLoading(true);
    try {
      const user = await login(values.email, values.password);

      // Reset attempts on successful login
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('loginLockout');
      setAttemptCount(0);
      setLockoutTime(null);

      // Save email if remember me is checked
      if (values.remember) {
        try {
          localStorage.setItem('savedEmail', values.email);
          localStorage.setItem('rememberMe', 'true');
        } catch (err) {
          console.warn('Could not save login preferences:', err);
        }
      } else {
        try {
          localStorage.removeItem('savedEmail');
          localStorage.removeItem('rememberMe');
        } catch (err) {
          console.warn('Could not clear login preferences:', err);
        }
      }

      if (user) {
        toast.success('Welcome back to Community Savings!', {
          autoClose: 3000,
        });
        navigate('/dashboard', { replace: true });
      } else {
        toast.error('Login did not complete. Please try again.');
      }
    } catch (err) {
      // Track failed attempts
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);
      localStorage.setItem('loginAttempts', newAttemptCount.toString());

      // Lock account after max attempts
      if (newAttemptCount >= MAX_ATTEMPTS) {
        const lockoutEnd = new Date(Date.now() + LOCKOUT_DURATION);
        setLockoutTime(lockoutEnd);
        localStorage.setItem('loginLockout', lockoutEnd.toISOString());
        toast.error(
          'Too many failed attempts. Please try again in 15 minutes.',
          { autoClose: 5000 }
        );
      } else {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Login failed. Please check your credentials.';
        
        // Don't expose specific user existence information
        const displayMessage = 
          err?.response?.status === 401
            ? 'Invalid email or password'
            : message;
        
        toast.error(displayMessage, {
          autoClose: 4000,
        });
        console.error('Login error:', err);
      }
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  }, [login, navigate, attemptCount, lockoutTime]);


  return (
    <div className="login-page">
      <div className="login-wrapper">
        {/* Left side - Brand/Info */}
        <div className="login-brand">
          <div className="brand-content">
            <h1 className="brand-title">Community Savings</h1>
            <p className="brand-subtitle">Grow Your Wealth Together</p>
            <div className="brand-features" role="list">
              <div className="feature" role="listitem">
                <div className="feature-icon" aria-hidden="true">
                  💰
                </div>
                <p>Secure Savings</p>
              </div>
              <div className="feature" role="listitem">
                <div className="feature-icon" aria-hidden="true">
                  👥
                </div>
                <p>Community Driven</p>
              </div>
              <div className="feature" role="listitem">
                <div className="feature-icon" aria-hidden="true">
                  🚀
                </div>
                <p>Grow Together</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="login-container">
          <div className="login-card">
            <h2 className="login-heading">Welcome Back</h2>
            <p className="login-subtitle">
              Enter your credentials to access your account
            </p>

            {/* Show lockout warning */}
            {lockoutTime && new Date() < new Date(lockoutTime) && (
              <div
                className="lockout-warning"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle size={18} />
                <span>
                  Account temporarily locked. Please try again in 15 minutes.
                </span>
              </div>
            )}

            {/* Show attempt count warning */}
            {!lockoutTime && attemptCount > 2 && attemptCount < MAX_ATTEMPTS && (
              <div
                className="attempt-warning"
                role="alert"
                aria-live="polite"
              >
                <Info size={18} />
                <span>
                  {MAX_ATTEMPTS - attemptCount} attempt(s) remaining before
                  temporary lockout.
                </span>
              </div>
            )}

            <Formik
              initialValues={{
                email: getSavedEmail(),
                password: '',
                remember: getRememberMeStatus(),
              }}
              validationSchema={LoginSchema}
              onSubmit={handleLogin}
              validateOnChange={true}
              validateOnBlur={true}
            >
              {({ isSubmitting, errors, touched, isValid }) => (
                <Form className="login-form" noValidate>
                  {/* Email Field */}
                  <div className="form-group">
                    <label htmlFor="email" className="form-label">
                      <Mail className="form-icon" size={16} aria-hidden="true" />
                      Email Address
                    </label>
                    <Field
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      autoComplete="email"
                      disabled={loading || (lockoutTime && new Date() < new Date(lockoutTime))}
                      className={`form-input ${
                        touched.email && errors.email ? 'has-error' : ''
                      }`}
                      aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
                    />
                    {touched.email && errors.email && (
                      <div id="email-error" className="field-error" role="alert">
                        <AlertCircle size={14} aria-hidden="true" />
                        {errors.email}
                      </div>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="form-group">
                    <label htmlFor="password" className="form-label">
                      <Lock className="form-icon" size={16} aria-hidden="true" />
                      Password
                    </label>
                    <div className="password-input-wrapper">
                      <Field
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={loading || (lockoutTime && new Date() < new Date(lockoutTime))}
                        className={`form-input ${
                          touched.password && errors.password
                            ? 'has-error'
                            : ''
                        }`}
                        aria-describedby={
                          touched.password && errors.password
                            ? 'password-error'
                            : undefined
                        }
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        tabIndex="0"
                      >
                        {showPassword ? (
                          <EyeOff size={18} aria-hidden="true" />
                        ) : (
                          <Eye size={18} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {touched.password && errors.password && (
                      <div
                        id="password-error"
                        className="field-error"
                        role="alert"
                      >
                        <AlertCircle size={14} aria-hidden="true" />
                        {errors.password}
                      </div>
                    )}
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="form-options">
                    <label className="remember-checkbox">
                      <Field
                        type="checkbox"
                        name="remember"
                        disabled={loading}
                      />
                      <span>Remember me</span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="forgot-link"
                      tabIndex="0"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      isSubmitting ||
                      !isValid ||
                      (lockoutTime && new Date() < new Date(lockoutTime))
                    }
                    className="submit-btn"
                    aria-busy={loading || isSubmitting}
                  >
                    {loading ? (
                      <span className="btn-loading">
                        <span
                          className="spinner"
                          aria-hidden="true"
                        ></span>
                        Logging in...
                      </span>
                    ) : (
                      'Login to Account'
                    )}
                  </button>

                  {/* Register Link */}
                  <p className="signup-link">
                    Don't have an account?{' '}
                    <Link to="/register" className="link-highlight">
                      Create one now
                    </Link>
                  </p>
                </Form>
              )}
            </Formik>
          </div>

          {/* Footer */}
          <p className="login-footer">
            By logging in, you agree to our{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
