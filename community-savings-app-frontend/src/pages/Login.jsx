// src/pages/Login.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import './Login.css';

// Validation Schema
const LoginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required')
    .matches(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please enter a valid email address'
    ),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
});

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberMe') === 'true');

  // Auto-fill email if user requested "remember me"
  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail && rememberMe) {
      document.getElementById('email')?.setAttribute('value', savedEmail);
    }
  }, [rememberMe]);

  // Handle login
  const handleLogin = async (values, { setSubmitting }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      
      // Save email if remember me is checked
      if (values.remember) {
        localStorage.setItem('savedEmail', values.email);
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('savedEmail');
        localStorage.removeItem('rememberMe');
      }

      toast.success('Welcome back to Community Savings!');
      navigate('/dashboard');
    } catch (err) {
      const message = err?.response?.data?.message || 
                      err.message || 
                      'Login failed. Please check your credentials.';
      toast.error(message);
      console.error('Login error:', err);
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-wrapper">
        {/* Left side - Brand/Info */}
        <div className="login-brand">
          <div className="brand-content">
            <h1 className="brand-title">Community Savings</h1>
            <p className="brand-subtitle">Grow Your Wealth Together</p>
            <div className="brand-features">
              <div className="feature">
                <div className="feature-icon">💰</div>
                <p>Secure Savings</p>
              </div>
              <div className="feature">
                <div className="feature-icon">👥</div>
                <p>Community Driven</p>
              </div>
              <div className="feature">
                <div className="feature-icon">🚀</div>
                <p>Grow Together</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="login-container">
          <div className="login-card">
            <h2 className="login-heading">Welcome Back</h2>
            <p className="login-subtitle">Enter your credentials to access your account</p>

            <Formik
              initialValues={{
                email: localStorage.getItem('savedEmail') || '',
                password: '',
                remember: rememberMe,
              }}
              validationSchema={LoginSchema}
              onSubmit={handleLogin}
            >
              {({ isSubmitting, errors, touched }) => (
                <Form className="login-form">
                  {/* Email Field */}
                  <div className="form-group">
                    <label htmlFor="email" className="form-label">
                      <Mail className="form-icon" size={16} />
                      Email Address
                    </label>
                    <Field
                      id="email"
                      name="email"
                      type="email"
                      placeholder="your@email.com"
                      autoComplete="email"
                      className={`form-input ${touched.email && errors.email ? 'error' : ''}`}
                    />
                    {touched.email && errors.email && (
                      <div className="field-error">
                        <AlertCircle size={14} />
                        {errors.email}
                      </div>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="form-group">
                    <label htmlFor="password" className="form-label">
                      <Lock className="form-icon" size={16} />
                      Password
                    </label>
                    <div className="password-input-wrapper">
                      <Field
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className={`form-input ${touched.password && errors.password ? 'error' : ''}`}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {touched.password && errors.password && (
                      <div className="field-error">
                        <AlertCircle size={14} />
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
                        checked={rememberMe}
                        onChange={(e) => {
                          setRememberMe(e.target.checked);
                        }}
                      />
                      <span>Remember me</span>
                    </label>
                    <Link to="/forgot-password" className="forgot-link">
                      Forgot password?
                    </Link>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || isSubmitting}
                    className="submit-btn"
                  >
                    {loading ? (
                      <span className="btn-loading">
                        <span className="spinner"></span>
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
            <button
              type="button"
              className="footer-link"
              onClick={() => window.open('/terms', '_blank')}
            >
              Terms of Service
            </button>{' '}
            and{' '}
            <button
              type="button"
              className="footer-link"
              onClick={() => window.open('/privacy', '_blank')}
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
