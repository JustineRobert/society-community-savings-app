import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ProtectedRouteWithRole from './components/ProtectedRouteWithRole';
import Navbar from './components/Navbar';

import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import GroupList from './pages/GroupList';
import GroupDetails from './pages/GroupDetails';
import CreateGroup from './pages/CreateGroup';
import NotFound from './pages/NotFound';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminSettings from './pages/admin/AdminSettings';
import ManageUsers from './pages/admin/ManageUsers';
import AdminSessions from './pages/admin/AdminSessions';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
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

          <Route path="*" element={<NotFound />} />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRouteWithRole allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRouteWithRole>
            }
          />

          <Route
            path="/admin/settings"
            element={
              <ProtectedRouteWithRole allowedRoles={["admin"]}>
                <AdminSettings />
              </ProtectedRouteWithRole>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRouteWithRole allowedRoles={["admin"]}>
                <ManageUsers />
              </ProtectedRouteWithRole>
            }
          />

          <Route
            path="/admin/sessions"
            element={
              <ProtectedRouteWithRole allowedRoles={["admin"]}>
                <AdminSessions />
              </ProtectedRouteWithRole>
            }
          />
        </Routes>
        <ToastContainer position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}
