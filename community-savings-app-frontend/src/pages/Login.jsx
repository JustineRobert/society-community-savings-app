// src/pages/Login.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import './Login.css'; // ✅ Custom styling

// ✅ Validation Schema
const LoginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
});

const Login = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle, loginWithFacebook } = useAuth();
  const [loading, setLoading] = useState(false);

  // ✅ Handle Email/Password Login
  const handleLogin = async (values) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      const message =
        err?.response?.data?.message || err.message || 'Login failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle Google Login
  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      toast.success('Logged in with Google!');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Google login failed.');
    }
  };

  // ✅ Handle Facebook Login
  const handleFacebookLogin = async () => {
    try {
      await loginWithFacebook();
      toast.success('Logged in with Facebook!');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Facebook login failed.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1f44] via-[#122b5c] to-[#0a1f44] px-4 dark:bg-black">
      <div className="login-container">
        <h2 className="login-heading">Login to Your Account</h2>

        <Formik
          initialValues={{ email: '', password: '', remember: false }}
          validationSchema={LoginSchema}
          onSubmit={handleLogin}
        >
          {() => (
            <Form className="login-form">
              {/* ✅ Email Field */}
              <div>
                <Field
                  name="email"
                  type="email"
                  placeholder="Email address"
                  autoComplete="email"
                  className="input-field w-full dark:bg-gray-800 dark:text-white"
                />
                <ErrorMessage
                  name="email"
                  component="div"
                  className="text-red-500 text-sm mt-1 text-left"
                />
              </div>

              {/* ✅ Password Field */}
              <div>
                <Field
                  name="password"
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  className="input-field w-full dark:bg-gray-800 dark:text-white"
                />
                <ErrorMessage
                  name="password"
                  component="div"
                  className="text-red-500 text-sm mt-1 text-left"
                />
              </div>

              {/* ✅ Remember me + Forgot password */}
              <div className="flex items-center justify-between text-sm text-gray-200">
                <label className="inline-flex items-center">
                  <Field type="checkbox" name="remember" className="mr-2" />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => toast.info('Forgot password flow coming soon!')}
                  className="text-[#f5b642] hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {/* ✅ Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`submit-btn w-full ${loading ? 'loading cursor-not-allowed opacity-90' : 'hover:-translate-y-0.5'
                  }`}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              {/* ✅ Social Login */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-300 dark:text-gray-400 mb-2">Or login with</p>
                <div className="flex justify-center space-x-4">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
                  >
                    Google
                  </button>
                  <button
                    type="button"
                    onClick={handleFacebookLogin}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Facebook
                  </button>
                </div>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default Login;
