// src/App.js
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedRouteWithRole from "./components/ProtectedRouteWithRole";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import { ErrorBoundary, ErrorFallback } from "./components/ErrorBoundary";

// Lazy-loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Legal = lazy(() => import("./pages/Legal"));
const GroupList = lazy(() => import("./pages/GroupList"));
const GroupDetails = lazy(() => import("./pages/GroupDetails"));
const CreateGroup = lazy(() => import("./pages/CreateGroupV2"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const ManageUsers = lazy(() => import("./pages/admin/ManageUsers"));
const AdminSessions = lazy(() => import("./pages/admin/AdminSessions"));

function RouteFallback() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <p>Loading…</p>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);
  return null;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function reportError(error, errorInfo) {
  if (process.env.NODE_ENV !== "production") {
    console.error("Reported UI error:", error, errorInfo);
  }
}

function AppLayout({ children }) {
  const location = useLocation();

  const hideNavbarRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/terms",
    "/privacy",
    "/legal",
  ];

  const hideFooterRoutes = ["/login", "/register"];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {!hideNavbarRoutes.includes(location.pathname) && <Navbar />}
      <ScrollToTop />

      <div style={{ flex: 1 }}>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          resetKeys={[location.pathname]}
          onError={reportError}
        >
          <Suspense fallback={<RouteFallback />}>{children}</Suspense>
        </ErrorBoundary>
      </div>

      {!hideFooterRoutes.includes(location.pathname) && <Footer />}

      <ToastContainer position="top-right" autoClose={4000} theme="colored" />
    </div>
  );
}

function AdminLayout({ children }) {
  const location = useLocation();

  return (
    <ProtectedRouteWithRole allowedRoles={["admin"]}>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        resetKeys={[location.pathname]}
        onError={reportError}
      >
        <Suspense fallback={<RouteFallback />}>{children}</Suspense>
      </ErrorBoundary>
    </ProtectedRouteWithRole>
  );
}

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

          {/* ✅ Admin Routes */}
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