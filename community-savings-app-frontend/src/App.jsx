
// src/App.js
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedRouteWithRole from './components/ProtectedRouteWithRole';
import Navbar from './components/Navbar';

// ✅ NEW: import the ErrorBoundary and default fallback
import { ErrorBoundary, ErrorFallback } from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const GroupList = lazy(() => import('./pages/GroupList'));
const GroupDetails = lazy(() => import('./pages/GroupDetails'));
const CreateGroup = lazy(() => import('./pages/CreateGroup'));
const NotFound = lazy(() => import('./pages/NotFound'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const ManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const AdminSessions = lazy(() => import('./pages/admin/AdminSessions'));

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

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <RouteFallback />;
  }
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

/**
 * Centralized error reporting hook for ErrorBoundary.
 * Replace with Sentry/Datadog/etc. as needed.
 */
function reportError(error, errorInfo) {
  // Example: send to your logging service
  // Sentry.captureException(error, { extra: errorInfo });
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('Reported UI error:', error, errorInfo);
  }
}

function AppLayout({ children }) {
  const location = useLocation();
  const hideNavbarOnPaths = ['/login', '/register'];
  const shouldHideNavbar = hideNavbarOnPaths.includes(location.pathname);

  return (
    <>
      {!shouldHideNavbar && <Navbar />}
      <ScrollToTop />

      {/* ✅ Wrap Suspense with ErrorBoundary and reset on route change */}
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        fallbackProps={{ context: 'App layout' }}
        resetKeys={[location.pathname]}
        onError={reportError}
      >
        <Suspense fallback={<RouteFallback />}>
          {children}
        </Suspense>
      </ErrorBoundary>

      <ToastContainer
        position="top-right"
        autoClose={4000}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />
    </>
  );
}

function AdminLayout({ children }) {
  const location = useLocation();

  return (
    <ProtectedRouteWithRole allowedRoles={['admin']}>
      {/* ✅ Admin tree also protected by ErrorBoundary */}
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        fallbackProps={{ context: 'Admin layout' }}
        resetKeys={[location.pathname]}
        onError={reportError}
      >
        <Suspense fallback={<RouteFallback />}>
          {children}
        </Suspense>
      </ErrorBoundary>
    </ProtectedRouteWithRole>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

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
      </BrowserRouter>
    </AuthProvider>
  );
}
