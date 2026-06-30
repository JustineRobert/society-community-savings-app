// ============================================================================
// TITech Community Capital
// Enterprise Application Routes
// File: src/routes/AppRoutes.jsx
// Production Grade
// ============================================================================

import React, {
  Suspense,
  lazy,
  memo,
} from "react";

import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AdminLayout from "../layouts/AdminLayout";

import { useAuth } from "../context/AuthContext";

// ============================================================================
// Lazy Pages
// ============================================================================

const Dashboard = lazy(() =>
  import("../pages/Dashboard")
);

const Members = lazy(() =>
  import("../pages/Members")
);

const Savings = lazy(() =>
  import("../pages/Savings")
);

const Loans = lazy(() =>
  import("../pages/Loans")
);

const Transactions = lazy(() =>
  import("../pages/Transactions")
);

const Reports = lazy(() =>
  import("../pages/Reports")
);

// Optional pages
const Login = lazy(() =>
  import("../pages/Login")
);

const Register = lazy(() =>
  import("../pages/Register")
);

const Settings = lazy(() =>
  import("../pages/Settings")
);

const NotFound = lazy(() =>
  import("../pages/NotFound")
);

// ============================================================================
// Loading Screen
// ============================================================================

function RouteLoader() {
  return (
    <div className="route-loader">
      <div className="spinner" />

      <p>Loading...</p>
    </div>
  );
}

// ============================================================================
// Protected Route
// ============================================================================

function ProtectedRoute({
  children,
}) {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <RouteLoader />
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}

// ============================================================================
// Admin Route
// ============================================================================

function AdminRoute({
  children,
}) {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <RouteLoader />
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  const allowed =
    [
      "admin",
      "ADMIN",
      "super_admin",
    ].includes(
      user?.role
    );

  if (!allowed) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}

// ============================================================================
// Public Route
// ============================================================================

function PublicRoute({
  children,
}) {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <RouteLoader />
    );
  }

  if (user) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
}

// ============================================================================
// Route Definitions
// ============================================================================

function AppRoutes() {
  return (
    <Suspense
      fallback={
        <RouteLoader />
      }
    >
      <Routes>
        {/* =============================================================== */}
        {/* Public Routes */}
        {/* =============================================================== */}

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        {/* =============================================================== */}
        {/* Protected Layout */}
        {/* =============================================================== */}

        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            path="/dashboard"
            element={
              <Dashboard />
            }
          />

          <Route
            path="/members"
            element={
              <Members />
            }
          />

          <Route
            path="/savings"
            element={
              <Savings />
            }
          />

          <Route
            path="/loans"
            element={
              <Loans />
            }
          />

          <Route
            path="/transactions"
            element={
              <Transactions />
            }
          />

          <Route
            path="/reports"
            element={
              <Reports />
            }
          />

          {/* =========================================================== */}
          {/* Admin Only */}
          {/* =========================================================== */}

          <Route
            path="/settings"
            element={
              <AdminRoute>
                <Settings />
              </AdminRoute>
            }
          />
        </Route>

        {/* =============================================================== */}
        {/* Root Redirect */}
        {/* =============================================================== */}

        <Route
          path="/"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

        {/* =============================================================== */}
        {/* 404 */}
        {/* =============================================================== */}

        <Route
          path="*"
          element={
            <NotFound />
          }
        />
      </Routes>
    </Suspense>
  );
}

// ============================================================================
// Memoized Export
// ============================================================================

export default memo(
  AppRoutes
);