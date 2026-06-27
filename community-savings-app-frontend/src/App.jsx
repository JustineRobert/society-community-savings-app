// ============================================================================
// TITech Community Capital – Application Root
// File: frontend/src/App.jsx
// ============================================================================

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedRouteWithRole from './components/ProtectedRouteWithRole';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Legal = lazy(() => import('./pages/Legal'));
const GroupList = lazy(() => import('./pages/GroupList'));
const GroupDetails = lazy(() => import('./pages/GroupDetails'));
const CreateGroup = lazy(() => import('./pages/CreateGroupV2'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const AdminSessions = lazy(() => import('./pages/admin/AdminSessions'));

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function RouteFallback() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Loading…</p>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
}

function ErrorFallback({ onReset }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ marginBottom: 16 }}>
        An unexpected error occurred. You can try reloading the page or return to the dashboard.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }}
        >
          Reload
        </button>
        <button
          onClick={onReset}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: '#2563eb',
            color: '#fff',
            border: 'none',
          }}
        >
          Try Again
        </button>
        <a
          href="/dashboard"
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #ddd',
            textDecoration: 'none',
            color: '#111',
          }}
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function reportError(error, errorInfo) {
  if (process.env.NODE_ENV !== 'production') {
    // Local console logging for development
    console.error('Reported UI error:', error, errorInfo);
  }
  // TODO: send to external monitoring (Sentry, LogRocket, etc.)
}

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------
function AppLayout({ children }) {
  const location = useLocation();

  const hideNavbarRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/terms',
    '/privacy',
    '/legal',
  ];

  const hideFooterRoutes = ['/login', '/register'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {!hideNavbarRoutes.includes(location.pathname) && <Navbar />}
      <ScrollToTop />

      <main style={{ flex: 1 }}>
        <ErrorBoundary
          onError={reportError}
          onReset={() => {
            // optional: additional reset logic
          }}
        >
          <Suspense fallback={<RouteFallback />}>{children}</Suspense>
        </ErrorBoundary>
      </main>

      {!hideFooterRoutes.includes(location.pathname) && <Footer />}

      <ToastContainer position="top-right" autoClose={4000} theme="colored" />
    </div>
  );
}

function AdminLayout({ children }) {
  const location = useLocation();

  return (
    <ProtectedRouteWithRole allowedRoles={['admin']}>
      <ErrorBoundary
        onError={reportError}
        onReset={() => {
          // optional admin-specific reset logic
        }}
      >
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      </ErrorBoundary>
    </ProtectedRouteWithRole>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <AuthProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal" element={<Legal />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <GroupList />
              </ProtectedRoute>
            }
          />

          <Route
            path="/groups/:groupId"
            element={
              <ProtectedRoute>
                <GroupDetails />
              </ProtectedRoute>
            }
          />

          <Route
            path="/create-group"
            element={
              <ProtectedRoute>
                <CreateGroup />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminLayout>
                <AdminSettings />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminLayout>
                <ManageUsers />
              </AdminLayout>
            }
          />
          <Route
            path="/admin/sessions"
            element={
              <AdminLayout>
                <AdminSessions />
              </AdminLayout>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </AuthProvider>
  );
}
