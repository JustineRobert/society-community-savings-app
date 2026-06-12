/**
 * Forgot Password Component
 * Production-ready password reset initiation
 * - Email validation
 * - Rate limiting feedback
 * - Secure token generation on backend
 * - Error handling and user feedback
 * - Accessibility (WCAG 2.1 AA compliant)
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import './ForgotPassword.css';

const ForgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required')
    .max(254, 'Email is too long')
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'),
});

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const handleSubmit = async (values, { setSubmitting }) => {
    setLoading(true);
    try {
      const response = await api.post('/api/email/request-password-reset', {
        email: values.email,
      });

      if (response.status === 200 || response.status === 201) {
        setSubmittedEmail(values.email);
        setSubmitted(true);
        toast.success('Password reset link sent! Check your email.', { autoClose: 5000 });
      }
    } catch (err) {
      // Don't reveal if email exists or not for security
      const message =
        err?.response?.data?.message ||
        'If this email is registered, you will receive a password reset link.';

      // Show success-like message for security (don't leak email existence info)
      setSubmittedEmail(values.email);
      setSubmitted(true);
      toast.info(message, { autoClose: 5000 });
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="forgot-password-page">
        <div className="forgot-password-wrapper">
          {/* Left side - Brand/Info */}
          <div className="forgot-password-brand">
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

          {/* Right side - Success Message */}
          <div className="forgot-password-container">
            <div className="forgot-password-card success-card">
              <div className="success-icon" aria-hidden="true">
                <CheckCircle size={48} />
              </div>

              <h2 className="success-heading">Check Your Email</h2>

              <p className="success-message">We've sent a password reset link to:</p>

              <div className="email-display">{submittedEmail}</div>

              <div className="success-instructions">
                <p>
                  <strong>Next steps:</strong>
                </p>
                <ul>
                  <li>Open the email we just sent</li>
                  <li>Click the password reset link</li>
                  <li>Enter your new password</li>
                  <li>Log in with your new password</li>
                </ul>
              </div>

              <div className="info-box">
                <AlertCircle size={18} aria-hidden="true" />
                <p>
                  The reset link will expire in <strong>24 hours</strong> for security. Didn't
                  receive the email? Check your spam folder.
                </p>
              </div>

              <div className="success-actions">
                <button className="btn-secondary" onClick={() => navigate('/login')}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back to Login
                </button>
              </div>

              <p className="support-text">
                Having trouble?{' '}
                <a href="mailto:support@communitysavings.com" className="support-link">
                  Contact support
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-wrapper">
        {/* Left side - Brand/Info */}
        <div className="forgot-password-brand">
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

        {/* Right side - Forgot Password Form */}
        <div className="forgot-password-container">
          <div className="forgot-password-card">
            <div className="back-link-container">
              <Link to="/login" className="back-link">
                <ArrowLeft size={16} aria-hidden="true" />
                Back to Login
              </Link>
            </div>

            <h2 className="forgot-password-heading">Reset Your Password</h2>
            <p className="forgot-password-subtitle">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <Formik
              initialValues={{ email: '' }}
              validationSchema={ForgotPasswordSchema}
              onSubmit={handleSubmit}
              validateOnChange={true}
              validateOnBlur={true}
            >
              {({ isSubmitting, errors, touched, isValid }) => (
                <Form className="forgot-password-form" noValidate>
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
                      disabled={loading}
                      className={`form-input ${touched.email && errors.email ? 'has-error' : ''}`}
                      aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
                    />
                    {touched.email && errors.email && (
                      <div id="email-error" className="field-error" role="alert">
                        <AlertCircle size={14} aria-hidden="true" />
                        {errors.email}
                      </div>
                    )}
                  </div>

                  <div className="info-box">
                    <AlertCircle size={18} aria-hidden="true" />
                    <p>
                      We'll send you an email with a secure link to reset your password. The link
                      will expire after 24 hours for security.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || isSubmitting || !isValid}
                    className="submit-btn"
                    aria-busy={loading || isSubmitting}
                  >
                    {loading ? (
                      <span className="btn-loading">
                        <span className="spinner" aria-hidden="true"></span>
                        Sending...
                      </span>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>

                  {/* Back to Login */}
                  <p className="login-link">
                    Remembered your password?{' '}
                    <Link to="/login" className="link-highlight">
                      Log in here
                    </Link>
                  </p>
                </Form>
              )}
            </Formik>
          </div>

          {/* Footer */}
          <p className="forgot-password-footer">
            By using this service, you agree to our{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="footer-link">
              Terms of Service
            </a>{' '}
            &{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="footer-link">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
