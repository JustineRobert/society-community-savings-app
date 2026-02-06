
// src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, Check } from 'lucide-react';
import api from '../services/api';
import './Register.css';
import { useAuth } from '../context/AuthContext';

// Validation Schema
const RegisterSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .required('Full name is required')
    .matches(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),

  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required')
    .matches(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please enter a valid email address'
    ),

  phone: Yup.string()
    .optional()
    .matches(
      /^\+?[1-9]\d{1,14}$/,
      'Phone number must be in E.164 format (e.g., +256772123546)'
    ),

  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    )
    .required('Password is required'),

  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Please confirm your password'),

  agreeTerms: Yup.boolean()
    .oneOf([true], 'You must agree to the Terms of Service')
    .required('You must agree to the Terms of Service'),
});

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Calculate password strength
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/\d/)) strength++;
    if (password.match(/[@$!%*?&]/)) strength++;
    return strength;
  };

  const handleRegister = async (values, { setSubmitting }) => {
    setLoading(true);
    try {
      // Register user
      await api.post('/api/auth/register', {
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
      });

      toast.success('Account created successfully!');

      // Automatically log the user in after registration
      await login(values.email, values.password);
      navigate('/dashboard');
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed. Please try again.';
      toast.error(message);
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const getPasswordStrengthLabel = (strength) => {
    const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    return labels[strength - 1] || 'Too Weak';
  };

  const getPasswordStrengthColor = (strength) => {
    const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
    return colors[strength - 1] || '#ef4444';
  };

  return (
    <div className="register-page">
      <div className="register-wrapper">
        {/* Left side - Features */}
        <div className="register-features">
          <h1 className="features-title">Join Our Community</h1>
          <p className="features-subtitle">Start saving and growing together</p>

          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon">✓</div>
              <p>Secure savings platform</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">✓</div>
              <p>Community-driven growth</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">✓</div>
              <p>Mobile money integration</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">✓</div>
              <p>Group lending options</p>
            </div>
          </div>
        </div>

        {/* Right side - Registration Form */}
        <div className="register-container">
          <div className="register-card">
            <h2 className="register-heading">Create Account</h2>
            <p className="register-subtitle">Join thousands of savers worldwide</p>

            <Formik
              initialValues={{
                name: '',
                email: '',
                phone: '',
                password: '',
                confirmPassword: '',
                agreeTerms: false,
              }}
              validationSchema={RegisterSchema}
              onSubmit={handleRegister}
              validateOnChange={true}
              validateOnBlur={true}
            >
              {({ isSubmitting, errors, touched, values }) => (
                <Form className="register-form">
                  {/* Name Field */}
                  <div className="form-group">
                    <label htmlFor="name" className="form-label">
                      <User className="form-icon" size={16} />
                      Full Name
                    </label>
                    <Field
                      id="name"
                      name="name"
                      type="text"
                      placeholder="John Doe"
                      className={`form-input ${touched.name && errors.name ? 'error' : ''}`}
                    />
                    {touched.name && errors.name && (
                      <div className="field-error">
                        <AlertCircle size={14} />
                        {errors.name}
                      </div>
                    )}
                  </div>

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
                      className={`form-input ${touched.email && errors.email ? 'error' : ''}`}
                    />
                    {touched.email && errors.email && (
                      <div className="field-error">
                        <AlertCircle size={14} />
                        {errors.email}
                      </div>
                    )}
                  </div>

                  {/* Phone Field (Optional) */}
                  <div className="form-group">
                    <label htmlFor="phone" className="form-label">
                      <User className="form-icon" size={16} />
                      Phone Number (Optional)
                    </label>
                    <Field
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="+256772123546"
                      className={`form-input ${touched.phone && errors.phone ? 'error' : ''}`}
                    />
                    {touched.phone && errors.phone && (
                      <div className="field-error">
                        <AlertCircle size={14} />
                        {errors.phone}
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
                      <Field name="password">
                        {({ field }) => (
                          <input
                            {...field}
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className={`form-input ${touched.password && errors.password ? 'error' : ''}`}
                            onChange={(e) => {
                              // First, update Formik's internal state
                              field.onChange(e);
                              // Then update password strength indicator
                              const value = e.target.value;
                              if (value) {
                                setPasswordStrength(calculatePasswordStrength(value));
                              } else {
                                setPasswordStrength(0);
                              }
                            }}
                            onBlur={field.onBlur}
                          />
                        )}
                      </Field>
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {values.password && (
                      <div className="password-strength">
                        <div className="strength-meter">
                          <div
                            className="strength-bar"
                            style={{
                              width: `${(passwordStrength / 4) * 100}%`,
                              backgroundColor: getPasswordStrengthColor(passwordStrength),
                            }}
                          ></div>
                        </div>
                        <span
                          className="strength-text"
                          style={{ color: getPasswordStrengthColor(passwordStrength) }}
                        >
                          {getPasswordStrengthLabel(passwordStrength)}
                        </span>
                      </div>
                    )}

                    {touched.password && errors.password && (
                      <div className="field-error">
                        <AlertCircle size={14} />
                        {errors.password}
                      </div>
                    )}

                    {/* Password Requirements */}
                    <div className="password-requirements">
                      <p className="requirements-title">Password must contain:</p>
                      <ul>
                        <li className={values.password?.length >= 8 ? 'met' : ''}>
                          <Check size={12} />
                          At least 8 characters
                        </li>
                        <li
                          className={
                            values.password?.match(/[a-z]/) && values.password?.match(/[A-Z]/)
                              ? 'met'
                              : ''
                          }
                        >
                          <Check size={12} />
                          Uppercase and lowercase letters
                        </li>
                        <li className={values.password?.match(/\d/) ? 'met' : ''}>
                          <Check size={12} />
                          At least one number
                        </li>
                        <li className={values.password?.match(/[@$!%*?&]/) ? 'met' : ''}>
                          <Check size={12} />
                          One special character (@$!%*?&)
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="form-group">
                    <label htmlFor="confirmPassword" className="form-label">
                      <Lock className="form-icon" size={16} />
                      Confirm Password
                    </label>
                    <div className="password-input-wrapper">
                      <Field
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className={`form-input ${
                          touched.confirmPassword && errors.confirmPassword ? 'error' : ''
                        }`}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {touched.confirmPassword && errors.confirmPassword && (
                      <div className="field-error">
                        <AlertCircle size={14} />
                        {errors.confirmPassword}
                      </div>
                    )}
                  </div>

                  {/* Terms Agreement */}
                  <div className="form-group">
                    <label className="checkbox-label">
                      <Field
                        type="checkbox"
                        name="agreeTerms"
                      />
                      <span>
                        I agree to the{' '}
                        <button
                          type="button"
                          className="link"
                          onClick={() => window.open('/terms', '_blank')}
                        >
                          Terms of Service
                        </button>{' '}
                        and{' '}
                        <button
                          type="button"
                          className="link"
                          onClick={() => window.open('/privacy', '_blank')}
                        >
                          Privacy Policy
                        </button>
                      </span>
                    </label>
                    {touched.agreeTerms && errors.agreeTerms && (
                      <div className="field-error">
                        <AlertCircle size={14} />
                        {errors.agreeTerms}
                      </div>
                    )}
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
                        Creating account...
                      </span>
                    ) : (
                      'Create Account'
                    )}
                  </button>

                  {/* Login Link */}
                  <p className="login-link">
                    Already have an account?{' '}
                    <Link to="/login" className="link-highlight">
                      Sign in here
                    </Link>
                  </p>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
