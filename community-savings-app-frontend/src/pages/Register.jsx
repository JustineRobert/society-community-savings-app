// ============================================================================
// TITech Community Capital
// Production Grade Register Page
// File: src/pages/Register.jsx
// ============================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';

import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import './Register.css';

// ============================================================================
// VALIDATION
// ============================================================================

const RegisterSchema = Yup.object({
  name: Yup.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .required('Full name is required'),

  email: Yup.string()
    .trim()
    .email('Please enter a valid email address')
    .required('Email is required'),

  phone: Yup.string()
    .nullable()
    .test(
      'phone-format',
      'Phone number must be in international format',
      (value) => {
        if (!value) return true;
        return /^\+?[1-9]\d{1,14}$/.test(value);
      }
    ),

  password: Yup.string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Must contain an uppercase letter')
    .matches(/[a-z]/, 'Must contain a lowercase letter')
    .matches(/\d/, 'Must contain a number')
    .matches(
      /[@$!%*?&^#()_+\-=]/,
      'Must contain a special character'
    ),

  confirmPassword: Yup.string()
    .required('Please confirm password')
    .oneOf([Yup.ref('password')], 'Passwords do not match'),

  agreeTerms: Yup.boolean()
    .oneOf([true], 'You must accept the Terms & Conditions'),
});

// ============================================================================
// PASSWORD STRENGTH
// ============================================================================

const calculateStrength = (password) => {
  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[@$!%*?&^#()_+\-=]/.test(password)) score++;

  return score;
};

const strengthLabel = (score) => {
  if (score <= 1) return 'Weak';
  if (score === 2) return 'Fair';
  if (score === 3) return 'Good';
  if (score === 4) return 'Strong';
  return 'Very Strong';
};

const strengthColor = (score) => {
  if (score <= 1) return '#ef4444';
  if (score === 2) return '#f97316';
  if (score === 3) return '#eab308';
  if (score === 4) return '#22c55e';
  return '#16a34a';
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function Register() {
  const navigate = useNavigate();

  const { register } = useAuth();

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  // ==========================================================================
  // SUBMIT
  // ==========================================================================

  const handleRegister = async (
    values,
    { setSubmitting }
  ) => {
    try {
      setLoading(true);

      await register({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        phone: values.phone?.trim() || undefined,
      });

      toast.success(
        'Account created successfully'
      );

      navigate('/dashboard');
    } catch (error) {
      console.error(error);

      const status =
        error?.response?.status;

      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Registration failed';

      if (status === 429) {
        toast.error(
          'Too many requests. Please wait a moment and try again.'
        );
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // UI
  // ==========================================================================

  return (
    <div className="register-page">
      <div className="register-wrapper">

        {/* LEFT PANEL */}

        <div className="register-features">
          <h1 className="features-title">
            TITech Community Capital
          </h1>

          <p className="features-subtitle">
            Build wealth together through
            community savings and lending.
          </p>

          <div className="feature-list">

            <div className="feature-item">
              <CheckCircle size={18} />
              <span>
                Secure Savings Accounts
              </span>
            </div>

            <div className="feature-item">
              <CheckCircle size={18} />
              <span>
                Group Contributions
              </span>
            </div>

            <div className="feature-item">
              <CheckCircle size={18} />
              <span>
                Mobile Money Integration
              </span>
            </div>

            <div className="feature-item">
              <CheckCircle size={18} />
              <span>
                Community Loans
              </span>
            </div>

          </div>
        </div>

        {/* FORM */}

        <div className="register-container">

          <div className="register-card">

            <h2>Create Account</h2>

            <p className="register-subtitle">
              Start your financial journey today
            </p>

            <Formik
              initialValues={{
                name: '',
                email: '',
                phone: '',
                password: '',
                confirmPassword: '',
                agreeTerms: false,
              }}
              validationSchema={
                RegisterSchema
              }
              onSubmit={
                handleRegister
              }
            >
              {({
                values,
                errors,
                touched,
                isSubmitting,
              }) => {
                const strength =
                  calculateStrength(
                    values.password
                  );

                return (
                  <Form className="register-form">

                    {/* NAME */}

                    <div className="form-group">
                      <label>
                        <User size={16} />
                        Full Name
                      </label>

                      <Field
                        name="name"
                        className="form-input"
                        placeholder="Igune Justine Robert"
                      />

                      {touched.name &&
                        errors.name && (
                          <div className="field-error">
                            <AlertCircle size={14} />
                            {errors.name}
                          </div>
                        )}
                    </div>

                    {/* EMAIL */}

                    <div className="form-group">
                      <label>
                        <Mail size={16} />
                        Email
                      </label>

                      <Field
                        type="email"
                        name="email"
                        className="form-input"
                        placeholder="justinerobert@example.com"
                      />

                      {touched.email &&
                        errors.email && (
                          <div className="field-error">
                            <AlertCircle size={14} />
                            {errors.email}
                          </div>
                        )}
                    </div>

                    {/* PHONE */}

                    <div className="form-group">
                      <label>
                        <Phone size={16} />
                        Phone (Optional)
                      </label>

                      <Field
                        name="phone"
                        className="form-input"
                        placeholder="+256782397907"
                      />

                      {touched.phone &&
                        errors.phone && (
                          <div className="field-error">
                            <AlertCircle size={14} />
                            {errors.phone}
                          </div>
                        )}
                    </div>

                    {/* PASSWORD */}

                    <div className="form-group">

                      <label>
                        <Lock size={16} />
                        Password
                      </label>

                      <div className="password-input-wrapper">
                        <Field
                          type={
                            showPassword
                              ? 'text'
                              : 'password'
                          }
                          name="password"
                          className="form-input"
                          placeholder="Enter password"
                        />

                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() =>
                            setShowPassword(
                              !showPassword
                            )
                          }
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>

                      {values.password && (
                        <div
                          className="password-strength"
                        >
                          <div
                            className="strength-meter"
                          >
                            <div
                              className="strength-bar"
                              style={{
                                width: `${(strength / 5) * 100}%`,
                                backgroundColor:
                                  strengthColor(
                                    strength
                                  ),
                              }}
                            />
                          </div>

                          <span
                            style={{
                              color:
                                strengthColor(
                                  strength
                                ),
                            }}
                          >
                            {strengthLabel(
                              strength
                            )}
                          </span>
                        </div>
                      )}

                      {touched.password &&
                        errors.password && (
                          <div className="field-error">
                            <AlertCircle size={14} />
                            {errors.password}
                          </div>
                        )}
                    </div>

                    {/* CONFIRM PASSWORD */}

                    <div className="form-group">
                      <label>
                        <Lock size={16} />
                        Confirm Password
                      </label>

                      <div className="password-input-wrapper">
                        <Field
                          type={
                            showConfirmPassword
                              ? 'text'
                              : 'password'
                          }
                          name="confirmPassword"
                          className="form-input"
                          placeholder="Confirm password"
                        />

                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() =>
                            setShowConfirmPassword(
                              !showConfirmPassword
                            )
                          }
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>

                      {touched.confirmPassword &&
                        errors.confirmPassword && (
                          <div className="field-error">
                            <AlertCircle size={14} />
                            {errors.confirmPassword}
                          </div>
                        )}
                    </div>

                    {/* TERMS */}

                    <div className="form-group">
                      <label className="checkbox-label">
                        <Field
                          type="checkbox"
                          name="agreeTerms"
                        />

                        <span>
                          I agree to the Terms
                          and Privacy Policy
                        </span>
                      </label>

                      {touched.agreeTerms &&
                        errors.agreeTerms && (
                          <div className="field-error">
                            <AlertCircle size={14} />
                            {errors.agreeTerms}
                          </div>
                        )}
                    </div>

                    {/* BUTTON */}

                    <button
                      type="submit"
                      className="submit-btn"
                      disabled={
                        loading ||
                        isSubmitting
                      }
                    >
                      {loading
                        ? 'Creating Account...'
                        : 'Create Account'}
                    </button>

                    <div className="login-link">
                      Already have an account?{' '}
                      <Link to="/login">
                        Sign In
                      </Link>
                    </div>

                  </Form>
                );
              }}
            </Formik>

          </div>
        </div>
      </div>
    </div>
  );
}