/**
 * Reset Password Component
 * Production-ready password reset completion
 * - Token validation
 * - Secure password submission
 * - Password strength validation
 * - Error handling and user feedback
 * - Accessibility (WCAG 2.1 AA compliant)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import './ResetPassword.css';

const ResetPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      'Password must contain uppercase, lowercase, number, and special character'
    )
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your password'),
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenValidating, setTokenValidating] = useState(true);
  const [resetSuccess, setResetSuccess] = useState(false);

  const token = searchParams.get('token');

  // Validate token format and existence
  useEffect(() => {
    if (!token) {
      setTokenValidating(false);
      toast.error('Invalid or missing reset token', { autoClose: 5000 });
      setTimeout(() => navigate('/forgot-password'), 3000);
      return;
    }

    if (!isValidTokenFormat(token)) {
      setTokenValidating(false);
      toast.error('Invalid reset token format', { autoClose: 5000 });
      setTimeout(() => navigate('/forgot-password'), 3000);
      return;
    }

    setTokenValid(true);
    setTokenValidating(false);
  }, [token, navigate]);

  const isValidTokenFormat = (t) => {
    // Token should be 40 character hex string
    return /^[a-f0-9]{40}$/i.test(t);
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    if (!token) {
      toast.error('Token is missing');
      return;
    }

    if (values.password !== values.confirmPassword) {
      toast.error('Passwords do not match');
      setSubmitting(false);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/email/reset-password', {
        token,
        password: values.password,
        confirmPassword: values.confirmPassword,
      });

      if (response.status === 200) {
        setResetSuccess(true);
        toast.success('Password reset successful! Redirecting to login...', {
          autoClose: 5000,
        });

        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to reset password. Please try again.';

      if (err?.response?.status === 400) {
        toast.error('Invalid or expired reset token', { autoClose: 5000 });
        setTimeout(() => navigate('/forgot-password'), 3000);
      } else {
        toast.error(message, { autoClose: 5000 });
      }
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  if (tokenValidating) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-wrapper">
          <div className="reset-password-brand">
            <div className="brand-content">
              <h1 className="brand-title">Community Savings</h1>
              <p className="brand-subtitle">Grow Your Wealth Together</p>
            </div>
          </div>
          <div className="reset-password-container">
            <div className="reset-password-card">
              <div className="loading-spinner" aria-hidden="true"></div>
              <p>Validating reset token...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-wrapper">
          <div className="reset-password-brand">
            <div className="brand-content">
              <h1 className="brand-title">Community Savings</h1>
              <p className="brand-subtitle">Grow Your Wealth Together</p>
            </div>
          </div>
          <div className="reset-password-container">
            <div className="reset-password-card error-card">
              <AlertCircle size={48} color="#e63946" />
              <h2>Invalid Reset Link</h2>
              <p>This password reset link is invalid or has expired.</p>
              <Link to="/forgot-password" className="submit-btn">
                Request New Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-wrapper">
          <div className="reset-password-brand">
            <div className="brand-content">
              <h1 className="brand-title">Community Savings</h1>
              <p className="brand-subtitle">Grow Your Wealth Together</p>
            </div>
          </div>
          <div className="reset-password-container">
            <div className="reset-password-card success-card">
              <CheckCircle size={48} />
              <h2>Password Reset Successful!</h2>
              <p>
                Your password has been successfully reset.
                You can now log in with your new password.
              </p>
              <p className="redirect-message">
                Redirecting to login in 3 seconds...
              </p>
              <Link to="/login" className="submit-btn">
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-wrapper">
        {/* Left side - Brand/Info */}
        <div className="reset-password-brand">
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

        {/* Right side - Reset Password Form */}
        <div className="reset-password-container">
          <div className="reset-password-card">
            <Link to="/login" className="back-link">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to Login
            </Link>

            <h2 className="reset-password-heading">Create New Password</h2>
            <p className="reset-password-subtitle">
              Enter a strong password to protect your account.
            </p>

            <Formik
              initialValues={{
                password: '',
                confirmPassword: '',
              }}
              validationSchema={ResetPasswordSchema}
              onSubmit={handleSubmit}
              validateOnChange={true}
              validateOnBlur={true}
            >
              {({ isSubmitting, errors, touched, isValid, values }) => (
                <Form className="reset-password-form" noValidate>
                  {/* Password Field */}
                  <div className="form-group">
                    <label htmlFor="password" className="form-label">
                      <Lock className="form-icon" size={16} aria-hidden="true" />
                      New Password
                    </label>
                    <div className="password-input-wrapper">
                      <Field
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        disabled={loading}
                        className={`form-input ${
                          touched.password && errors.password ? 'has-error' : ''
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

                  {/* Confirm Password Field */}
                  <div className="form-group">
                    <label htmlFor="confirmPassword" className="form-label">
                      <Lock className="form-icon" size={16} aria-hidden="true" />
                      Confirm Password
                    </label>
                    <div className="password-input-wrapper">
                      <Field
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        disabled={loading}
                        className={`form-input ${
                          touched.confirmPassword && errors.confirmPassword
                            ? 'has-error'
                            : ''
                        }`}
                        aria-describedby={
                          touched.confirmPassword && errors.confirmPassword
                            ? 'confirm-password-error'
                            : undefined
                        }
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={
                          showConfirmPassword ? 'Hide password' : 'Show password'
                        }
                        tabIndex="0"
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} aria-hidden="true" />
                        ) : (
                          <Eye size={18} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {touched.confirmPassword && errors.confirmPassword && (
                      <div
                        id="confirm-password-error"
                        className="field-error"
                        role="alert"
                      >
                        <AlertCircle size={14} aria-hidden="true" />
                        {errors.confirmPassword}
                      </div>
                    )}
                  </div>

                  {/* Password Requirements */}
                  <div className="password-requirements">
                    <p className="requirements-title">Password must contain:</p>
                    <ul className="requirements-list">
                      <li>
                        <span className={values.password?.length >= 8 ? 'met' : ''}>
                          ✓ At least 8 characters
                        </span>
                      </li>
                      <li>
                        <span
                          className={
                            /[A-Z]/.test(values.password) ? 'met' : ''
                          }
                        >
                          ✓ One uppercase letter (A-Z)
                        </span>
                      </li>
                      <li>
                        <span
                          className={
                            /[a-z]/.test(values.password) ? 'met' : ''
                          }
                        >
                          ✓ One lowercase letter (a-z)
                        </span>
                      </li>
                      <li>
                        <span className={/\d/.test(values.password) ? 'met' : ''}>
                          ✓ One number (0-9)
                        </span>
                      </li>
                      <li>
                        <span
                          className={
                            /[@$!%*?&]/.test(values.password) ? 'met' : ''
                          }
                        >
                          ✓ One special character (@$!%*?&)
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={
                      loading || isSubmitting || !isValid
                    }
                    className="submit-btn"
                    aria-busy={loading || isSubmitting}
                  >
                    {loading ? (
                      <span className="btn-loading">
                        <span className="spinner" aria-hidden="true"></span>
                        Resetting Password...
                      </span>
                    ) : (
                      'Reset Password'
                    )}
                  </button>

                  {/* Back to Login */}
                  <p className="login-link">
                    Remember your password?{' '}
                    <Link to="/login" className="link-highlight">
                      Log in here
                    </Link>
                  </p>
                </Form>
              )}
            </Formik>
          </div>

          {/* Footer */}
          <p className="reset-password-footer">
            By using this service, you agree to our{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Terms of Service
            </a>
            {' '}&{' '}
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

export default ResetPassword;
